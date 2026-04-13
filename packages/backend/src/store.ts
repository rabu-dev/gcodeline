import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import {
  Asset,
  Build,
  BuildStatus,
  Commit,
  PullRequest,
  Task,
  TaskStatus,
  TimelineEvent,
  User
} from "./domain.js";

const now = () => new Date().toISOString();

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }
  return JSON.parse(value) as T;
}

function serialize(value: unknown) {
  return JSON.stringify(value);
}

export class AppStore {
  constructor(public db: PrismaClient) {}

  async seed() {
    const userCount = await this.db.user.count();
    if (userCount > 0) {
      return;
    }

    const userId = randomUUID();
    const teamId = randomUUID();
    const projectId = randomUUID();
    const taskId = randomUUID();

    await this.db.user.create({
      data: {
        id: userId,
        name: "Demo Owner",
        email: "owner@gcodeline.dev",
        avatar: "https://avatars.githubusercontent.com/u/1?v=4",
        roles: serialize(["Owner"])
      }
    });

    await this.db.team.create({
      data: {
        id: teamId,
        name: "Indie Strike Team",
        members: serialize([userId])
      }
    });

    await this.db.project.create({
      data: {
        id: projectId,
        teamId,
        name: "UE5 Arena Prototype",
        repoMappings: serialize(["indie-studio/arena-prototype"])
      }
    });

    await this.db.task.create({
      data: {
        id: taskId,
        projectId,
        title: "Wire asset traceability panel",
        description: "Show commits, PRs, assets and builds in a single task view.",
        status: "in_progress",
        priority: "high",
        assignees: serialize([userId]),
        linkedCommits: serialize([]),
        linkedAssets: serialize([]),
        linkedPRs: serialize([])
      }
    });

    await this.db.timelineEvent.create({
      data: {
        id: randomUUID(),
        taskId,
        type: "comment",
        title: "Task created from MVP seed data",
        createdAt: now(),
        meta: null
      }
    });
  }

  async getCurrentUser(sessionId?: string): Promise<User> {
    if (sessionId) {
      const session = await this.db.session.findUnique({
        where: { id: sessionId },
        include: { user: true }
      });
      if (session) {
        return {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          avatar: session.user.avatar ?? undefined,
          roles: parseJson<User["roles"]>(session.user.roles, [])
        };
      }
    }

    const row = await this.db.user.findFirstOrThrow({ orderBy: { name: "asc" } });
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      avatar: row.avatar ?? undefined,
      roles: parseJson<User["roles"]>(row.roles, [])
    };
  }

  async upsertGitHubUser(input: { login: string; name?: string; email?: string; avatarUrl?: string }) {
    const id = `github:${input.login}`;
    const user = await this.db.user.upsert({
      where: { id },
      update: {
        name: input.name || input.login,
        email: input.email || `${input.login}@users.noreply.github.com`,
        avatar: input.avatarUrl,
        roles: serialize(["Owner"])
      },
      create: {
        id,
        name: input.name || input.login,
        email: input.email || `${input.login}@users.noreply.github.com`,
        avatar: input.avatarUrl,
        roles: serialize(["Owner"])
      }
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar ?? undefined,
      roles: parseJson<User["roles"]>(user.roles, [])
    } satisfies User;
  }

  async createSession(userId: string) {
    const session = await this.db.session.create({
      data: {
        id: randomUUID(),
        userId,
        createdAt: now()
      }
    });
    return session.id;
  }

  async getProjects() {
    const rows = await this.db.project.findMany({ orderBy: { name: "asc" } });
    return rows.map((row) => ({
      id: row.id,
      teamId: row.teamId,
      name: row.name,
      repoMappings: parseJson<string[]>(row.repoMappings, [])
    }));
  }

  async createProject(input: { teamId: string; name: string; repoMappings: string[] }) {
    const project = await this.db.project.create({
      data: {
        id: randomUUID(),
        teamId: input.teamId,
        name: input.name,
        repoMappings: serialize(input.repoMappings)
      }
    });
    return {
      id: project.id,
      teamId: project.teamId,
      name: project.name,
      repoMappings: input.repoMappings
    };
  }

  async getProject(id: string) {
    const row = await this.db.project.findUnique({ where: { id } });
    if (!row) {
      return undefined;
    }
    return {
      id: row.id,
      teamId: row.teamId,
      name: row.name,
      repoMappings: parseJson<string[]>(row.repoMappings, [])
    };
  }

  async listTasksByProject(projectId: string) {
    const rows = await this.db.task.findMany({ where: { projectId }, orderBy: { title: "asc" } });
    return rows.map((row) => this.mapTask(row));
  }

  async createTask(projectId: string, input: { title: string; description: string; priority: Task["priority"]; assignees: string[] }) {
    const id = randomUUID();
    await this.db.task.create({
      data: {
        id,
        projectId,
        title: input.title,
        description: input.description,
        status: "todo",
        priority: input.priority,
        assignees: serialize(input.assignees),
        linkedCommits: serialize([]),
        linkedAssets: serialize([]),
        linkedPRs: serialize([])
      }
    });
    await this.addTimeline(id, "comment", `Task created: ${input.title}`);
    return this.getTask(id);
  }

  async getTask(id: string) {
    const row = await this.db.task.findUnique({ where: { id } });
    return row ? this.mapTask(row) : undefined;
  }

  async getTaskDetails(id: string) {
    const task = await this.getTask(id);
    if (!task) {
      return undefined;
    }

    const commits = task.linkedCommits.length > 0
      ? await this.db.commit.findMany({ where: { hash: { in: task.linkedCommits } } })
      : [];
    const prs = task.linkedPRs.length > 0
      ? await this.db.pullRequest.findMany({ where: { id: { in: task.linkedPRs } } })
      : [];
    const assets = await Promise.all(task.linkedAssets.map((assetId) => this.getAsset(assetId)));

    return {
      ...task,
      commits: commits.map((commit) => ({
        hash: commit.hash,
        message: commit.message,
        author: commit.author,
        date: commit.date,
        filesChanged: parseJson<string[]>(commit.filesChanged, [])
      })),
      assets: assets.filter(Boolean),
      prs: prs.map((pr) => ({
        id: pr.id,
        number: pr.number,
        title: pr.title,
        status: pr.status,
        repo: pr.repo,
        linkedTaskIds: parseJson<string[]>(pr.linkedTaskIds, [])
      })),
      timeline: await this.getTimeline(task.id)
    };
  }

  async updateTask(id: string, patch: Partial<Task>) {
    const current = await this.getTask(id);
    if (!current) {
      return undefined;
    }

    const updated: Task = {
      ...current,
      ...patch,
      id: current.id,
      projectId: current.projectId
    };

    await this.db.task.update({
      where: { id },
      data: {
        title: updated.title,
        description: updated.description,
        status: updated.status,
        priority: updated.priority,
        assignees: serialize(updated.assignees),
        linkedCommits: serialize(updated.linkedCommits),
        linkedAssets: serialize(updated.linkedAssets),
        linkedPRs: serialize(updated.linkedPRs)
      }
    });

    return updated;
  }

  async registerUnrealToken(projectId: string, pluginVersion: string, machineName: string) {
    const token = `ue_${projectId.slice(0, 8)}_${randomUUID().slice(0, 8)}`;
    await this.db.unrealToken.create({
      data: {
        token,
        projectId,
        pluginVersion,
        machineName,
        createdAt: now()
      }
    });
    return { token, projectId, pluginVersion, machineName };
  }

  async validateUnrealToken(token: string) {
    return this.db.unrealToken.findUnique({ where: { token } });
  }

  async upsertAsset(input: { projectId: string; taskId?: string; unrealGuid: string; path: string; hash: string; size: number; dependencies: string[] }) {
    const existing = await this.db.asset.findUnique({ where: { unrealGuid: input.unrealGuid } });
    const assetId = existing?.id ?? randomUUID();

    if (existing) {
      await this.db.asset.update({
        where: { id: assetId },
        data: {
          projectId: input.projectId,
          taskId: input.taskId,
          path: input.path,
          hash: input.hash,
          size: input.size,
          dependencies: serialize(input.dependencies)
        }
      });
    } else {
      await this.db.asset.create({
        data: {
          id: assetId,
          projectId: input.projectId,
          taskId: input.taskId,
          unrealGuid: input.unrealGuid,
          path: input.path,
          hash: input.hash,
          size: input.size,
          dependencies: serialize(input.dependencies)
        }
      });
    }

    await this.db.assetVersion.create({
      data: {
        id: randomUUID(),
        assetId,
        hash: input.hash,
        changedAt: now()
      }
    });

    if (input.taskId) {
      const task = await this.getTask(input.taskId);
      if (task && !task.linkedAssets.includes(assetId)) {
        task.linkedAssets.push(assetId);
        await this.updateTask(task.id, { linkedAssets: task.linkedAssets });
      }
      await this.addTimeline(input.taskId, "asset", `Asset synced: ${input.path}`, {
        assetId,
        unrealGuid: input.unrealGuid
      });
      const user = await this.getCurrentUser();
      await this.createNotification(user.id, "asset.updated", "Asset updated", `${input.path} was synced from Unreal.`);
    }

    return this.getAsset(assetId);
  }

  async getAsset(assetId: string) {
    const row = await this.db.asset.findUnique({
      where: { id: assetId },
      include: { versions: { orderBy: { changedAt: "desc" } } }
    });
    if (!row) {
      return undefined;
    }

    return {
      id: row.id,
      projectId: row.projectId,
      taskId: row.taskId ?? undefined,
      unrealGuid: row.unrealGuid,
      path: row.path,
      hash: row.hash,
      size: row.size,
      dependencies: parseJson<string[]>(row.dependencies, []),
      versions: row.versions.map((entry) => ({
        id: entry.id,
        hash: entry.hash,
        changedAt: entry.changedAt
      })),
      snapshotUrl: row.snapshotUrl ?? undefined
    } satisfies Asset;
  }

  async attachSnapshot(assetId: string, snapshotUrl: string) {
    await this.db.asset.update({
      where: { id: assetId },
      data: { snapshotUrl }
    });
    const asset = await this.getAsset(assetId);
    if (asset?.taskId) {
      await this.addTimeline(asset.taskId, "asset", "Snapshot uploaded", { assetId });
    }
    return asset;
  }

  async recordCommit(taskId: string, commit: Commit) {
    await this.db.commit.upsert({
      where: { hash: commit.hash },
      update: {
        message: commit.message,
        author: commit.author,
        date: commit.date,
        filesChanged: serialize(commit.filesChanged)
      },
      create: {
        hash: commit.hash,
        message: commit.message,
        author: commit.author,
        date: commit.date,
        filesChanged: serialize(commit.filesChanged)
      }
    });

    const task = await this.getTask(taskId);
    if (task && !task.linkedCommits.includes(commit.hash)) {
      task.linkedCommits.push(commit.hash);
      await this.updateTask(task.id, { linkedCommits: task.linkedCommits });
    }

    await this.addTimeline(taskId, "commit", `Commit linked: ${commit.message}`, { hash: commit.hash });
    return commit;
  }

  async recordPullRequest(taskId: string, pullRequest: PullRequest) {
    await this.db.pullRequest.upsert({
      where: { id: pullRequest.id },
      update: {
        number: pullRequest.number,
        title: pullRequest.title,
        status: pullRequest.status,
        repo: pullRequest.repo,
        linkedTaskIds: serialize(pullRequest.linkedTaskIds)
      },
      create: {
        id: pullRequest.id,
        number: pullRequest.number,
        title: pullRequest.title,
        status: pullRequest.status,
        repo: pullRequest.repo,
        linkedTaskIds: serialize(pullRequest.linkedTaskIds)
      }
    });

    const task = await this.getTask(taskId);
    if (task && !task.linkedPRs.includes(pullRequest.id)) {
      task.linkedPRs.push(pullRequest.id);
      await this.updateTask(task.id, { linkedPRs: task.linkedPRs });
    }

    await this.addTimeline(taskId, "pr", `PR ${pullRequest.number}: ${pullRequest.title}`, {
      prId: pullRequest.id,
      status: pullRequest.status
    });

    const user = await this.getCurrentUser();
    await this.createNotification(user.id, "pr.updated", "Pull request updated", `PR #${pullRequest.number} is now ${pullRequest.status}.`);
    return pullRequest;
  }

  async startBuild(input: { taskId?: string; prId?: string; trigger: string }) {
    const build: Build = {
      id: randomUUID(),
      taskId: input.taskId,
      prId: input.prId,
      status: "queued",
      logsUrl: `https://example.invalid/logs/${Date.now()}.log`,
      artifactUrl: `https://example.invalid/artifacts/${Date.now()}.zip`,
      startedAt: now()
    };

    await this.db.build.create({
      data: {
        id: build.id,
        taskId: build.taskId,
        prId: build.prId,
        status: build.status,
        trigger: input.trigger,
        logsUrl: build.logsUrl,
        artifactUrl: build.artifactUrl,
        startedAt: build.startedAt
      }
    });

    if (build.taskId) {
      await this.addTimeline(build.taskId, "build", `Build queued from ${input.trigger}`, { buildId: build.id });
    }

    return build;
  }

  async updateBuildStatus(buildId: string, status: BuildStatus) {
    const build = await this.db.build.update({
      where: { id: buildId },
      data: {
        status,
        finishedAt: status === "passed" || status === "failed" ? now() : undefined
      }
    });

    if (build.taskId) {
      await this.addTimeline(build.taskId, "build", `Build ${status}`, { buildId });
      const user = await this.getCurrentUser();
      await this.createNotification(user.id, "build.updated", "Build status changed", `Build ${build.id} is ${status}.`);
    }

    return this.getBuild(buildId);
  }

  async getBuild(id: string) {
    const row = await this.db.build.findUnique({ where: { id } });
    if (!row) {
      return undefined;
    }
    return {
      id: row.id,
      taskId: row.taskId ?? undefined,
      prId: row.prId ?? undefined,
      status: row.status as BuildStatus,
      logsUrl: row.logsUrl ?? undefined,
      artifactUrl: row.artifactUrl ?? undefined,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt ?? undefined
    } satisfies Build;
  }

  async createNotification(userId: string, kind: string, title: string, body: string) {
    const notification = await this.db.notification.create({
      data: {
        id: randomUUID(),
        userId,
        kind,
        title,
        body,
        createdAt: now()
      }
    });

    return {
      id: notification.id,
      userId: notification.userId,
      kind: notification.kind,
      title: notification.title,
      body: notification.body
    };
  }

  async listNotifications(userId: string) {
    const rows = await this.db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      kind: row.kind,
      title: row.title,
      body: row.body,
      readAt: row.readAt ?? undefined,
      createdAt: row.createdAt
    }));
  }

  async createOAuthState(redirectTo?: string) {
    const state = randomUUID();
    await this.db.oAuthState.create({
      data: {
        state,
        redirectTo,
        createdAt: now()
      }
    });
    return state;
  }

  async consumeOAuthState(state: string) {
    const row = await this.db.oAuthState.findUnique({ where: { state } });
    if (!row) {
      return undefined;
    }
    await this.db.oAuthState.delete({ where: { state } });
    return {
      state: row.state,
      redirectTo: row.redirectTo ?? undefined
    };
  }

  async saveIntegrationToken(input: { provider: string; accessToken: string; refreshToken?: string; scope?: string; accountLogin?: string }) {
    const token = await this.db.integrationToken.create({
      data: {
        id: randomUUID(),
        provider: input.provider,
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        scope: input.scope,
        accountLogin: input.accountLogin,
        createdAt: now()
      }
    });
    return token.id;
  }

  async enqueueEvent(eventName: string, payload: Record<string, unknown>, delayMs = 0) {
    const job = await this.db.eventQueue.create({
      data: {
        id: randomUUID(),
        eventName,
        payload: serialize(payload),
        status: "queued",
        createdAt: now(),
        availableAt: new Date(Date.now() + delayMs).toISOString()
      }
    });
    return job.id;
  }

  async reserveNextEvent() {
    const row = await this.db.eventQueue.findFirst({
      where: {
        status: "queued",
        availableAt: {
          lte: now()
        }
      },
      orderBy: { createdAt: "asc" }
    });

    if (!row) {
      return undefined;
    }

    await this.db.eventQueue.update({
      where: { id: row.id },
      data: { status: "processing" }
    });

    return {
      id: row.id,
      eventName: row.eventName,
      payload: parseJson<Record<string, unknown>>(row.payload, {})
    };
  }

  async completeEvent(id: string) {
    await this.db.eventQueue.update({
      where: { id },
      data: {
        status: "done",
        processedAt: now()
      }
    });
  }

  async failEvent(id: string) {
    await this.db.eventQueue.update({
      where: { id },
      data: {
        status: "queued",
        availableAt: new Date(Date.now() + 1000).toISOString()
      }
    });
  }

  async search(query: string, type?: string) {
    const q = query.toLowerCase();
    const hits: Array<{ type: string; item: unknown }> = [];

    if (!type || type === "issue") {
      const rows = await this.db.task.findMany();
      hits.push(
        ...rows
          .filter((row) => row.title.toLowerCase().includes(q) || row.id.includes(query))
          .map((row) => ({ type: "issue", item: this.mapTask(row) }))
      );
    }

    if (!type || type === "commit") {
      const rows = await this.db.commit.findMany();
      hits.push(
        ...rows
          .filter((row) => row.hash.includes(query) || row.message.toLowerCase().includes(q))
          .map((row) => ({
            type: "commit",
            item: {
              hash: row.hash,
              message: row.message,
              author: row.author,
              date: row.date,
              filesChanged: parseJson<string[]>(row.filesChanged, [])
            }
          }))
      );
    }

    if (!type || type === "asset") {
      const rows = await this.db.asset.findMany();
      for (const row of rows.filter((asset) => asset.unrealGuid.includes(query) || asset.path.toLowerCase().includes(q))) {
        hits.push({ type: "asset", item: await this.getAsset(row.id) });
      }
    }

    return hits;
  }

  async getTimeline(taskId: string) {
    const rows = await this.db.timelineEvent.findMany({
      where: { taskId },
      orderBy: { createdAt: "desc" }
    });

    return rows.map((row) => ({
      id: row.id,
      taskId: row.taskId,
      type: row.type as TimelineEvent["type"],
      title: row.title,
      createdAt: row.createdAt,
      meta: parseJson<Record<string, string> | undefined>(row.meta, undefined)
    }));
  }

  async disconnect() {
    await this.db.$disconnect();
  }

  private async addTimeline(taskId: string, type: TimelineEvent["type"], title: string, meta?: Record<string, string>) {
    await this.db.timelineEvent.create({
      data: {
        id: randomUUID(),
        taskId,
        type,
        title,
        createdAt: now(),
        meta: meta ? serialize(meta) : null
      }
    });
  }

  private mapTask(row: {
    id: string;
    projectId: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    assignees: string;
    linkedCommits: string;
    linkedAssets: string;
    linkedPRs: string;
  }) {
    return {
      id: row.id,
      projectId: row.projectId,
      title: row.title,
      description: row.description,
      status: row.status as TaskStatus,
      priority: row.priority as Task["priority"],
      assignees: parseJson<string[]>(row.assignees, []),
      linkedCommits: parseJson<string[]>(row.linkedCommits, []),
      linkedAssets: parseJson<string[]>(row.linkedAssets, []),
      linkedPRs: parseJson<string[]>(row.linkedPRs, [])
    } satisfies Task;
  }
}
