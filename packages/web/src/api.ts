import type { Project, TaskDetails } from "./types";

const API_BASE = "http://localhost:4000";

export async function getMe() {
  const response = await fetch(`${API_BASE}/api/me`);
  return response.json();
}

export async function getGitHubAuthUrl() {
  const response = await fetch(`${API_BASE}/api/integrations/github/connect`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      redirectTo: window.location.origin
    })
  });
  return response.json() as Promise<{ authorizeUrl: string; oauthConfigured: boolean }>;
}

export async function getNotifications() {
  const response = await fetch(`${API_BASE}/api/notifications`);
  return response.json() as Promise<{ notifications: Array<{ id: string; title: string; body: string; createdAt: string }> }>;
}

export async function getProjects(): Promise<Project[]> {
  const response = await fetch(`${API_BASE}/api/projects`);
  const payload = await response.json() as { projects: Project[] };
  return payload.projects;
}

export async function getProject(id: string) {
  const response = await fetch(`${API_BASE}/api/projects/${id}`);
  return response.json() as Promise<Project & { tasks: Array<{ id: string; title: string; status: string }> }>;
}

export async function getTask(id: string): Promise<TaskDetails> {
  const response = await fetch(`${API_BASE}/api/tasks/${id}`);
  return response.json() as Promise<TaskDetails>;
}
