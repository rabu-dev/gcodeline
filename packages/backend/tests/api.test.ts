import { createHmac } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { createApp } from "../src/app.js";

async function startTestServer() {
  const dbPath = join(process.cwd(), "data", `test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
  process.env.DATABASE_PATH = dbPath;
  process.env.GITHUB_WEBHOOK_SECRET = "dev-secret";

  const { app, eventBus, store } = createApp();
  eventBus.start();

  const server = createServer(app);
  server.listen(0);
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Test server failed to start");
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
    cleanup: () => {
      eventBus.stop();
      store.db.close();
      rmSync(dbPath, { force: true });
    }
  };
}

test("create task, ingest asset and link commit through webhook", async () => {
  const { server, baseUrl, cleanup } = await startTestServer();

  try {
    const projectsResponse = await fetch(`${baseUrl}/api/projects`);
    const projectsJson = await projectsResponse.json() as { projects: Array<{ id: string }> };
    const projectId = projectsJson.projects[0].id;

    const createTaskResponse = await fetch(`${baseUrl}/api/projects/${projectId}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Review floating platform material",
        description: "Track Unreal asset + Git commit in one place",
        assignees: [],
        priority: "high"
      })
    });
    const task = await createTaskResponse.json() as { id: string };

    const unrealAuthResponse = await fetch(`${baseUrl}/api/integrations/unreal/auth`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId,
        pluginVersion: "0.1.0",
        machineName: "test-runner"
      })
    });
    const unrealAuth = await unrealAuthResponse.json() as { token: string };

    const assetResponse = await fetch(`${baseUrl}/api/integrations/unreal/assets`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${unrealAuth.token}`
      },
      body: JSON.stringify({
        projectId,
        taskId: task.id,
        unrealGuid: "ASSET-GUID-001",
        path: "/Game/Maps/Arena/SM_Platform",
        hash: "abc123",
        size: 2048,
        dependencies: ["/Game/Materials/M_Platform"]
      })
    });
    assert.equal(assetResponse.status, 201);

    const webhookPayload = {
      event: "push",
      action: "updated",
      repository: { full_name: "indie-studio/arena-prototype" },
      sender: { login: "octocat" },
      commits: [
        {
          id: "deadbeef1234",
          message: `task:${task.id} Link platform material review`,
          timestamp: new Date().toISOString(),
          author: { name: "octocat" },
          added: ["Source/Game/Platform.cpp"],
          modified: [],
          removed: []
        }
      ]
    };
    const rawPayload = JSON.stringify(webhookPayload);
    const signature = `sha256=${createHmac("sha256", "dev-secret").update(rawPayload).digest("hex")}`;

    const webhookResponse = await fetch(`${baseUrl}/api/integrations/github/webhook`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": signature
      },
      body: rawPayload
    });
    assert.equal(webhookResponse.status, 202);

    const taskResponse = await fetch(`${baseUrl}/api/tasks/${task.id}`);
    const taskJson = await taskResponse.json() as {
      linkedAssets: string[];
      linkedCommits: string[];
      timeline: Array<{ type: string }>;
    };

    assert.equal(taskJson.linkedAssets.length, 1);
    assert.ok(taskJson.linkedCommits.includes("deadbeef1234"));
    assert.ok(taskJson.timeline.some((entry) => entry.type === "asset"));
    assert.ok(taskJson.timeline.some((entry) => entry.type === "commit"));
  } finally {
    server.close();
    cleanup();
  }
});
