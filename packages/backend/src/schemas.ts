import { z } from "zod";

export const createProjectSchema = z.object({
  teamId: z.string(),
  name: z.string().min(3),
  repoMappings: z.array(z.string()).default([])
});

export const createTaskSchema = z.object({
  title: z.string().min(3),
  description: z.string().default(""),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  assignees: z.array(z.string()).default([])
});

export const updateTaskSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().optional(),
  status: z.enum(["backlog", "todo", "in_progress", "review", "done"]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  assignees: z.array(z.string()).optional(),
  linkedCommits: z.array(z.string()).optional(),
  linkedAssets: z.array(z.string()).optional(),
  linkedPRs: z.array(z.string()).optional()
});

export const unrealAuthSchema = z.object({
  projectId: z.string(),
  pluginVersion: z.string(),
  machineName: z.string()
});

export const assetMetadataSchema = z.object({
  projectId: z.string(),
  taskId: z.string().optional(),
  unrealGuid: z.string(),
  path: z.string(),
  hash: z.string(),
  size: z.number().nonnegative(),
  dependencies: z.array(z.string()).default([])
});

export const githubConnectSchema = z.object({
  installationHint: z.string().optional(),
  redirectTo: z.string().url().optional()
});

export const githubWebhookSchema = z.object({
  event: z.enum(["push", "pull_request", "issues"]),
  action: z.string(),
  repository: z.object({
    full_name: z.string()
  }),
  sender: z.object({
    login: z.string()
  }),
  issue: z.object({
    number: z.number(),
    title: z.string()
  }).optional(),
  pull_request: z.object({
    number: z.number(),
    title: z.string(),
    merged: z.boolean().optional()
  }).optional(),
  commits: z.array(z.object({
    id: z.string(),
    message: z.string(),
    timestamp: z.string(),
    author: z.object({
      name: z.string()
    }),
    added: z.array(z.string()).default([]),
    modified: z.array(z.string()).default([]),
    removed: z.array(z.string()).default([])
  })).optional()
});

export const buildStartSchema = z.object({
  taskId: z.string().optional(),
  prId: z.string().optional(),
  trigger: z.enum(["manual", "pr_opened", "asset_ready"])
});
