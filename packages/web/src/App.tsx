import { useEffect, useState } from "react";
import { getGitHubAuthUrl, getMe, getNotifications, getProject, getProjects, getTask } from "./api";
import type { Project, TaskDetails } from "./types";

type Session = {
  user: {
    name: string;
    email: string;
    avatar?: string;
  };
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [projectTasks, setProjectTasks] = useState<Array<{ id: string; title: string; status: string }>>([]);
  const [task, setTask] = useState<TaskDetails | null>(null);
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; body: string; createdAt: string }>>([]);

  useEffect(() => {
    void (async () => {
      const me = await getMe();
      const allProjects = await getProjects();
      const notificationFeed = await getNotifications();
      setSession(me);
      setProjects(allProjects);
      setNotifications(notificationFeed.notifications);
      if (allProjects[0]) {
        setSelectedProjectId(allProjects[0].id);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      return;
    }

    void (async () => {
      const project = await getProject(selectedProjectId);
      setProjectTasks(project.tasks);
      if (project.tasks[0]) {
        setSelectedTaskId(project.tasks[0].id);
      }
    })();
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedTaskId) {
      return;
    }

    void (async () => {
      setTask(await getTask(selectedTaskId));
    })();
  }, [selectedTaskId]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">GCodeLine</p>
          <h1>Trace your game production flow</h1>
          <p className="lede">
            Tasks, commits, PRs, assets and builds in one collaborative surface.
          </p>
        </div>

        <button
          className="github-button"
          type="button"
          onClick={() => {
            void (async () => {
              const auth = await getGitHubAuthUrl();
              if (auth.oauthConfigured) {
                window.location.href = auth.authorizeUrl;
              } else {
                window.alert("Configura GITHUB_CLIENT_ID y GITHUB_CLIENT_SECRET en el backend para activar OAuth real.");
              }
            })();
          }}
        >
          Continue with GitHub
        </button>

        {session ? (
          <div className="profile-card">
            <p className="eyebrow">Session</p>
            <strong>{session.user.name}</strong>
            <span>{session.user.email}</span>
          </div>
        ) : null}

        <div className="picker">
          <label htmlFor="project-select">Project</label>
          <select
            id="project-select"
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        <div className="profile-card notification-card">
          <p className="eyebrow">Notifications</p>
          {notifications.slice(0, 3).map((notification) => (
            <div key={notification.id} className="notification-item">
              <strong>{notification.title}</strong>
              <span>{notification.body}</span>
            </div>
          ))}
        </div>
      </aside>

      <main className="workspace">
        <section className="board-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Sprint board</p>
              <h2>Project tasks</h2>
            </div>
          </div>

          <div className="task-list">
            {projectTasks.map((projectTask) => (
              <button
                key={projectTask.id}
                type="button"
                className={projectTask.id === selectedTaskId ? "task-pill active" : "task-pill"}
                onClick={() => setSelectedTaskId(projectTask.id)}
              >
                <span>{projectTask.title}</span>
                <small>{projectTask.status.replace("_", " ")}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="detail-grid">
          <article className="detail-card">
            <p className="eyebrow">Task</p>
            <h2>{task?.title ?? "Select a task"}</h2>
            <p>{task?.description}</p>

            <div className="chip-row">
              <span className="chip">Status: {task?.status}</span>
              <span className="chip">Priority: {task?.priority}</span>
              <span className="chip">Assets: {task?.linkedAssets.length ?? 0}</span>
              <span className="chip">Commits: {task?.linkedCommits.length ?? 0}</span>
            </div>
          </article>

          <article className="detail-card trace-card">
            <div className="section-header">
              <div>
                <p className="eyebrow">Traceability</p>
                <h2>Linked entities</h2>
              </div>
            </div>

            <div className="trace-columns">
              <div>
                <h3>Assets</h3>
                {task?.assets.map((asset) => (
                  <div key={asset.id} className="trace-item">
                    <strong>{asset.path}</strong>
                    <span>{asset.unrealGuid}</span>
                  </div>
                ))}
              </div>
              <div>
                <h3>Commits</h3>
                {task?.commits.map((commit) => (
                  <div key={commit.hash} className="trace-item">
                    <strong>{commit.message}</strong>
                    <span>{commit.hash.slice(0, 8)}</span>
                  </div>
                ))}
              </div>
              <div>
                <h3>PRs</h3>
                {task?.prs.map((pr) => (
                  <div key={pr.id} className="trace-item">
                    <strong>#{pr.number}</strong>
                    <span>{pr.title}</span>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className="detail-card">
            <p className="eyebrow">Timeline</p>
            <h2>Recent activity</h2>
            <div className="timeline">
              {task?.timeline.map((event) => (
                <div key={event.id} className="timeline-item">
                  <strong>{event.title}</strong>
                  <span>
                    {event.type} · {new Date(event.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
