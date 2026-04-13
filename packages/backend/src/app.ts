import { createHmac, timingSafeEqual } from "node:crypto";
import cors from "cors";
import express from "express";
import { getAppConfig, githubOAuthEnabled } from "./config.js";
import { createDatabase } from "./db.js";
import { EventBus } from "./event-bus.js";
import {
  assetMetadataSchema,
  buildStartSchema,
  createProjectSchema,
  createTaskSchema,
  githubConnectSchema,
  githubWebhookSchema,
  unrealAuthSchema,
  updateTaskSchema
} from "./schemas.js";
import { AppStore } from "./store.js";

function getSessionIdFromCookie(cookieHeader?: string) {
  if (!cookieHeader) {
    return undefined;
  }

  const match = cookieHeader.match(/gcodeline_session=([^;]+)/);
  return match?.[1];
}

function getRequestSessionId(req: express.Request) {
  return req.header("x-gcodeline-session") ?? getSessionIdFromCookie(req.header("cookie"));
}

export async function createApp(deps?: { store?: AppStore; eventBus?: EventBus }) {
  const appConfig = getAppConfig();
  const oauthCallbackUrl = `${appConfig.webBaseUrl}/api/auth/github/callback`;
  const store = deps?.store ?? new AppStore(createDatabase());
  await store.seed();
  const eventBus = deps?.eventBus ?? new EventBus(store);

  const app = express();
  app.use(cors());
  app.use(express.json({
    limit: "10mb",
    verify: (req, _res, buffer) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
    }
  }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, oauth: githubOAuthEnabled() });
  });

  app.get("/api/me", async (_req, res, next) => {
    try {
      const sessionId = getRequestSessionId(_req);
      const user = await store.getCurrentUser(sessionId);
      res.json({
        user,
        permissions: ["projects:read", "tasks:write", "assets:write", "builds:write"],
        notifications: await store.listNotifications(user.id)
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/auth/github/connect", async (req, res, next) => {
    try {
      const query = githubConnectSchema.parse({
        installationHint: req.query.installationHint,
        redirectTo: req.query.redirectTo
      });
      const state = await store.createOAuthState(query.redirectTo);

      if (!githubOAuthEnabled()) {
        return res.status(503).json({
          error: "GitHub OAuth is not configured",
          missing: ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"]
        });
      }

      const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
      authorizeUrl.searchParams.set("client_id", appConfig.githubClientId);
      authorizeUrl.searchParams.set("redirect_uri", oauthCallbackUrl);
      authorizeUrl.searchParams.set("scope", "repo read:user user:email");
      authorizeUrl.searchParams.set("state", state);
      if (query.installationHint) {
        authorizeUrl.searchParams.set("login", query.installationHint);
      }

      return res.redirect(302, authorizeUrl.toString());
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/auth/github/callback", async (req, res, next) => {
    try {
      const code = String(req.query.code ?? "");
      const state = String(req.query.state ?? "");
      const persistedState = await store.consumeOAuthState(state);

      if (!code || !persistedState) {
        return res.status(400).json({ error: "Invalid OAuth callback state" });
      }

      if (!githubOAuthEnabled()) {
        return res.status(503).json({ error: "GitHub OAuth is not configured" });
      }

      const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "accept": "application/json"
        },
        body: JSON.stringify({
          client_id: appConfig.githubClientId,
          client_secret: appConfig.githubClientSecret,
          code,
          redirect_uri: oauthCallbackUrl
        })
      });
      const tokenPayload = await tokenResponse.json() as {
        access_token?: string;
        refresh_token?: string;
        scope?: string;
        error?: string;
      };

      if (!tokenPayload.access_token) {
        return res.status(401).json({ error: tokenPayload.error ?? "GitHub token exchange failed" });
      }

      const meResponse = await fetch("https://api.github.com/user", {
        headers: {
          authorization: `Bearer ${tokenPayload.access_token}`,
          "user-agent": "GCodeLine"
        }
      });
      const me = await meResponse.json() as {
        login?: string;
        name?: string;
        email?: string;
        avatar_url?: string;
      };

      let email = me.email;
      if (!email) {
        const emailsResponse = await fetch("https://api.github.com/user/emails", {
          headers: {
            authorization: `Bearer ${tokenPayload.access_token}`,
            "user-agent": "GCodeLine"
          }
        });
        if (emailsResponse.ok) {
          const emails = await emailsResponse.json() as Array<{ email: string; primary: boolean; verified: boolean }>;
          email = emails.find((entry) => entry.primary)?.email ?? emails[0]?.email;
        }
      }

      await store.saveIntegrationToken({
        provider: "github",
        accessToken: tokenPayload.access_token,
        refreshToken: tokenPayload.refresh_token,
        scope: tokenPayload.scope,
        accountLogin: me.login
      });

      const user = await store.upsertGitHubUser({
        login: me.login ?? "github-user",
        name: me.name,
        email,
        avatarUrl: me.avatar_url
      });
      const sessionId = await store.createSession(user.id);

      res.cookie("gcodeline_session", sessionId, {
        httpOnly: false,
        sameSite: "lax",
        secure: false,
        path: "/"
      });

      const redirectUrl = new URL(persistedState.redirectTo ?? `${appConfig.webBaseUrl}/`);
      redirectUrl.searchParams.set("github", "connected");
      redirectUrl.searchParams.set("account", me.login ?? "github");
      redirectUrl.searchParams.set("session", sessionId);
      return res.redirect(302, redirectUrl.toString());
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/projects", async (_req, res, next) => {
    try {
      res.json({ projects: await store.getProjects() });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/projects", async (req, res, next) => {
    try {
      const input = createProjectSchema.parse(req.body);
      res.status(201).json(await store.createProject(input));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/projects/:id", async (req, res, next) => {
    try {
      const project = await store.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      return res.json({
        ...project,
        tasks: await store.listTasksByProject(project.id)
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/projects/:id/tasks", async (req, res, next) => {
    try {
      const project = await store.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      const input = createTaskSchema.parse(req.body);
      const task = await store.createTask(project.id, input);
      const user = await store.getCurrentUser();
      await eventBus.publish("notification.emit", {
        userId: user.id,
        kind: "task.created",
        title: "Task created",
        body: `${task?.title ?? "Task"} is ready for assignment.`
      });
      return res.status(201).json(task);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/tasks/:id", async (req, res, next) => {
    try {
      const task = await store.getTaskDetails(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/tasks/:id", async (req, res, next) => {
    try {
      const patch = updateTaskSchema.parse(req.body);
      const updated = await store.updateTask(req.params.id, patch);
      if (!updated) {
        return res.status(404).json({ error: "Task not found" });
      }
      return res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/integrations/github/connect", async (req, res, next) => {
    try {
      const input = githubConnectSchema.parse(req.body);
      const state = await store.createOAuthState(input.redirectTo);
      const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
      authorizeUrl.searchParams.set("client_id", appConfig.githubClientId || "missing-client-id");
      authorizeUrl.searchParams.set("redirect_uri", oauthCallbackUrl);
      authorizeUrl.searchParams.set("scope", "repo read:user user:email");
      authorizeUrl.searchParams.set("state", state);
      if (input.installationHint) {
        authorizeUrl.searchParams.set("login", input.installationHint);
      }
      res.json({ authorizeUrl: authorizeUrl.toString(), oauthConfigured: githubOAuthEnabled() });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/integrations/github/repos", (_req, res) => {
    res.json({
      repos: [
        {
          id: 1,
          fullName: "indie-studio/arena-prototype",
          permissions: ["issues", "pull_requests", "contents"]
        }
      ]
    });
  });

  app.post("/api/integrations/github/webhook", async (req, res, next) => {
    try {
      const signature = req.header("x-hub-signature-256");
      const rawBody = (req as express.Request & { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body));

      if (!signature || !verifyGitHubSignature(rawBody, signature, appConfig.githubWebhookSecret)) {
        return res.status(401).json({ error: "Invalid webhook signature" });
      }

      const payload = githubWebhookSchema.parse(JSON.parse(rawBody.toString("utf8")));
      const targetTask = await resolveTaskFromWebhook(store, payload);

      if (!targetTask) {
        return res.status(404).json({ error: "No task available for webhook routing" });
      }

      if (payload.event === "push" && payload.commits) {
        for (const commit of payload.commits) {
          await store.recordCommit(targetTask.id, {
            hash: commit.id,
            message: commit.message,
            author: commit.author.name,
            date: commit.timestamp,
            filesChanged: [...commit.added, ...commit.modified, ...commit.removed]
          });
        }
      }

      if (payload.event === "pull_request" && payload.pull_request) {
        const pullRequest = await store.recordPullRequest(targetTask.id, {
          id: `${payload.repository.full_name}#${payload.pull_request.number}`,
          number: payload.pull_request.number,
          title: payload.pull_request.title,
          repo: payload.repository.full_name,
          status: payload.pull_request.merged ? "merged" : payload.action === "closed" ? "closed" : "open",
          linkedTaskIds: [targetTask.id]
        });

        if (pullRequest.status === "open") {
          const build = await store.startBuild({ taskId: targetTask.id, prId: pullRequest.id, trigger: "pr_opened" });
          await eventBus.publish("build.requested", { buildId: build.id });
        }
      }

      if (payload.event === "issues" && payload.issue) {
        await store.updateTask(targetTask.id, { title: payload.issue.title });
      }

      return res.status(202).json({ accepted: true });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/integrations/unreal/auth", async (req, res, next) => {
    try {
      const input = unrealAuthSchema.parse(req.body);
      res.status(201).json(await store.registerUnrealToken(input.projectId, input.pluginVersion, input.machineName));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/integrations/unreal/assets", async (req, res, next) => {
    try {
      const authHeader = req.header("authorization");
      if (!authHeader?.startsWith("Bearer ") || !await store.validateUnrealToken(authHeader.replace("Bearer ", ""))) {
        return res.status(401).json({ error: "Invalid Unreal plugin token" });
      }

      const input = assetMetadataSchema.parse(req.body);
      const asset = await store.upsertAsset(input);
      if (input.taskId && asset) {
        const user = await store.getCurrentUser();
        await eventBus.publish("notification.emit", {
          userId: user.id,
          kind: "asset.ready",
          title: "Asset ready for review",
          body: `${asset.path} is linked to task ${input.taskId}.`
        });
      }
      return res.status(201).json(asset);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/integrations/unreal/assets/:id/snapshot", async (req, res, next) => {
    try {
      const authHeader = req.header("authorization");
      if (!authHeader?.startsWith("Bearer ") || !await store.validateUnrealToken(authHeader.replace("Bearer ", ""))) {
        return res.status(401).json({ error: "Invalid Unreal plugin token" });
      }

      const snapshotUrl = req.body.snapshotUrl ?? `data:image/png;base64,${req.body.snapshotBase64 ?? ""}`;
      const asset = await store.attachSnapshot(req.params.id, snapshotUrl);
      if (!asset) {
        return res.status(404).json({ error: "Asset not found" });
      }
      return res.json(asset);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/builds/start", async (req, res, next) => {
    try {
      const input = buildStartSchema.parse(req.body);
      const build = await store.startBuild(input);
      await eventBus.publish("build.requested", { buildId: build.id });
      res.status(201).json(build);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/builds/:id", async (req, res, next) => {
    try {
      const build = await store.getBuild(req.params.id);
      if (!build) {
        return res.status(404).json({ error: "Build not found" });
      }
      return res.json(build);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/notifications", async (_req, res, next) => {
    try {
      const user = await store.getCurrentUser(getRequestSessionId(_req));
      res.json({
        notifications: await store.listNotifications(user.id)
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/search", async (req, res, next) => {
    try {
      const q = String(req.query.q ?? "");
      const type = req.query.type ? String(req.query.type) : undefined;
      res.json({
        query: q,
        results: await store.search(q, type)
      });
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: "Unexpected server error" });
  });

  return { app, store, eventBus };
}

export function verifyGitHubSignature(payload: Buffer, signature: string, secret: string) {
  const expected = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

async function resolveTaskFromWebhook(store: AppStore, payload: ReturnType<typeof githubWebhookSchema.parse>) {
  const candidates = [
    ...(payload.commits?.map((commit) => commit.message) ?? []),
    payload.pull_request?.title,
    payload.issue?.title
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const match = candidate.match(/task:([a-f0-9-]+)/i);
    if (!match) {
      continue;
    }

    const task = await store.getTask(match[1]);
    if (task) {
      return task;
    }
  }

  const projects = await store.getProjects();
  return projects[0] ? (await store.listTasksByProject(projects[0].id))[0] : undefined;
}
