import type { Project, TaskDetails } from "./types";

const API_BASE = "";
const SESSION_STORAGE_KEY = "gcodeline_session";

function getSessionId() {
  return window.localStorage.getItem(SESSION_STORAGE_KEY);
}

function getHeaders() {
  const sessionId = getSessionId();
  const headers: Record<string, string> = {};
  if (sessionId) {
    headers["x-gcodeline-session"] = sessionId;
  }
  return headers;
}

export function persistSessionFromUrl() {
  const url = new URL(window.location.href);
  const sessionId = url.searchParams.get("session");
  if (!sessionId) {
    return;
  }

  window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  url.searchParams.delete("session");
  window.history.replaceState({}, "", url.toString());
}

export async function getMe() {
  const response = await fetch(`${API_BASE}/api/me`, {
    headers: getHeaders()
  });
  return response.json();
}

export async function getGitHubAuthUrl() {
  const response = await fetch(`${API_BASE}/api/auth/github/connect?redirectTo=${encodeURIComponent(window.location.origin)}`);
  if (!response.ok) {
    throw new Error("No se pudo iniciar OAuth con GitHub.");
  }
  return response.json() as Promise<{ authorizeUrl: string }>;
}

export async function getNotifications() {
  const response = await fetch(`${API_BASE}/api/notifications`, {
    headers: getHeaders()
  });
  return response.json() as Promise<{ notifications: Array<{ id: string; title: string; body: string; createdAt: string }> }>;
}

export async function getProjects(): Promise<Project[]> {
  const response = await fetch(`${API_BASE}/api/projects`, {
    headers: getHeaders()
  });
  const payload = await response.json() as { projects: Project[] };
  return payload.projects;
}

export async function getProject(id: string) {
  const response = await fetch(`${API_BASE}/api/projects/${id}`, {
    headers: getHeaders()
  });
  return response.json() as Promise<Project & { tasks: Array<{ id: string; title: string; status: string }> }>;
}

export async function getTask(id: string): Promise<TaskDetails> {
  const response = await fetch(`${API_BASE}/api/tasks/${id}`, {
    headers: getHeaders()
  });
  return response.json() as Promise<TaskDetails>;
}
