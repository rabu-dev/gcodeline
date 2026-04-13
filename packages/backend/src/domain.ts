import { randomUUID } from "node:crypto";

export type Role = "Owner" | "Admin" | "Dev" | "Artist" | "Viewer";
export type TaskStatus = "backlog" | "todo" | "in_progress" | "review" | "done";
export type BuildStatus = "queued" | "running" | "passed" | "failed";

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  roles: Role[];
}

export interface Team {
  id: string;
  name: string;
  members: string[];
}

export interface Project {
  id: string;
  teamId: string;
  name: string;
  repoMappings: string[];
}

export interface Commit {
  hash: string;
  message: string;
  author: string;
  date: string;
  filesChanged: string[];
}

export interface PullRequest {
  id: string;
  number: number;
  title: string;
  status: "open" | "merged" | "closed";
  repo: string;
  linkedTaskIds: string[];
}

export interface AssetVersion {
  id: string;
  hash: string;
  changedAt: string;
}

export interface Asset {
  id: string;
  projectId: string;
  taskId?: string;
  unrealGuid: string;
  path: string;
  hash: string;
  size: number;
  dependencies: string[];
  versions: AssetVersion[];
  snapshotUrl?: string;
}

export interface Build {
  id: string;
  taskId?: string;
  prId?: string;
  status: BuildStatus;
  logsUrl?: string;
  artifactUrl?: string;
  startedAt: string;
  finishedAt?: string;
}

export interface TimelineEvent {
  id: string;
  taskId: string;
  type: "commit" | "asset" | "pr" | "build" | "comment";
  title: string;
  createdAt: string;
  meta?: Record<string, string>;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: "low" | "medium" | "high";
  assignees: string[];
  linkedCommits: string[];
  linkedAssets: string[];
  linkedPRs: string[];
}

export interface Database {
  currentUserId: string;
  users: Record<string, User>;
  teams: Record<string, Team>;
  projects: Record<string, Project>;
  tasks: Record<string, Task>;
  commits: Record<string, Commit>;
  pullRequests: Record<string, PullRequest>;
  assets: Record<string, Asset>;
  builds: Record<string, Build>;
  timeline: TimelineEvent[];
}

const now = () => new Date().toISOString();

export function createSeedDatabase(): Database {
  const userId = randomUUID();
  const teamId = randomUUID();
  const projectId = randomUUID();
  const taskId = randomUUID();

  return {
    currentUserId: userId,
    users: {
      [userId]: {
        id: userId,
        name: "Demo Owner",
        email: "owner@gcodeline.dev",
        avatar: "https://avatars.githubusercontent.com/u/1?v=4",
        roles: ["Owner"]
      }
    },
    teams: {
      [teamId]: {
        id: teamId,
        name: "Indie Strike Team",
        members: [userId]
      }
    },
    projects: {
      [projectId]: {
        id: projectId,
        teamId,
        name: "UE5 Arena Prototype",
        repoMappings: ["indie-studio/arena-prototype"]
      }
    },
    tasks: {
      [taskId]: {
        id: taskId,
        projectId,
        title: "Wire asset traceability panel",
        description: "Show commits, PRs, assets and builds in a single task view.",
        status: "in_progress",
        priority: "high",
        assignees: [userId],
        linkedCommits: [],
        linkedAssets: [],
        linkedPRs: []
      }
    },
    commits: {},
    pullRequests: {},
    assets: {},
    builds: {},
    timeline: [
      {
        id: randomUUID(),
        taskId,
        type: "comment",
        title: "Task created from MVP seed data",
        createdAt: now()
      }
    ]
  };
}
