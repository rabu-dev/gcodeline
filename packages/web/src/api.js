const API_BASE = "http://localhost:4000";
export async function getMe() {
    const response = await fetch(`${API_BASE}/api/me`);
    return response.json();
}
export async function getProjects() {
    const response = await fetch(`${API_BASE}/api/projects`);
    const payload = await response.json();
    return payload.projects;
}
export async function getProject(id) {
    const response = await fetch(`${API_BASE}/api/projects/${id}`);
    return response.json();
}
export async function getTask(id) {
    const response = await fetch(`${API_BASE}/api/tasks/${id}`);
    return response.json();
}
