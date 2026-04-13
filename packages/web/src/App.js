import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { getMe, getProject, getProjects, getTask } from "./api";
export default function App() {
    const [session, setSession] = useState(null);
    const [projects, setProjects] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState("");
    const [selectedTaskId, setSelectedTaskId] = useState("");
    const [projectTasks, setProjectTasks] = useState([]);
    const [task, setTask] = useState(null);
    useEffect(() => {
        void (async () => {
            const me = await getMe();
            const allProjects = await getProjects();
            setSession(me);
            setProjects(allProjects);
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
    return (_jsxs("div", { className: "app-shell", children: [_jsxs("aside", { className: "sidebar", children: [_jsxs("div", { children: [_jsx("p", { className: "eyebrow", children: "GCodeLine" }), _jsx("h1", { children: "Trace your game production flow" }), _jsx("p", { className: "lede", children: "Tasks, commits, PRs, assets and builds in one collaborative surface." })] }), _jsx("button", { className: "github-button", type: "button", children: "Continue with GitHub" }), session ? (_jsxs("div", { className: "profile-card", children: [_jsx("p", { className: "eyebrow", children: "Session" }), _jsx("strong", { children: session.user.name }), _jsx("span", { children: session.user.email })] })) : null, _jsxs("div", { className: "picker", children: [_jsx("label", { htmlFor: "project-select", children: "Project" }), _jsx("select", { id: "project-select", value: selectedProjectId, onChange: (event) => setSelectedProjectId(event.target.value), children: projects.map((project) => (_jsx("option", { value: project.id, children: project.name }, project.id))) })] })] }), _jsxs("main", { className: "workspace", children: [_jsxs("section", { className: "board-card", children: [_jsx("div", { className: "section-header", children: _jsxs("div", { children: [_jsx("p", { className: "eyebrow", children: "Sprint board" }), _jsx("h2", { children: "Project tasks" })] }) }), _jsx("div", { className: "task-list", children: projectTasks.map((projectTask) => (_jsxs("button", { type: "button", className: projectTask.id === selectedTaskId ? "task-pill active" : "task-pill", onClick: () => setSelectedTaskId(projectTask.id), children: [_jsx("span", { children: projectTask.title }), _jsx("small", { children: projectTask.status.replace("_", " ") })] }, projectTask.id))) })] }), _jsxs("section", { className: "detail-grid", children: [_jsxs("article", { className: "detail-card", children: [_jsx("p", { className: "eyebrow", children: "Task" }), _jsx("h2", { children: task?.title ?? "Select a task" }), _jsx("p", { children: task?.description }), _jsxs("div", { className: "chip-row", children: [_jsxs("span", { className: "chip", children: ["Status: ", task?.status] }), _jsxs("span", { className: "chip", children: ["Priority: ", task?.priority] }), _jsxs("span", { className: "chip", children: ["Assets: ", task?.linkedAssets.length ?? 0] }), _jsxs("span", { className: "chip", children: ["Commits: ", task?.linkedCommits.length ?? 0] })] })] }), _jsxs("article", { className: "detail-card trace-card", children: [_jsx("div", { className: "section-header", children: _jsxs("div", { children: [_jsx("p", { className: "eyebrow", children: "Traceability" }), _jsx("h2", { children: "Linked entities" })] }) }), _jsxs("div", { className: "trace-columns", children: [_jsxs("div", { children: [_jsx("h3", { children: "Assets" }), task?.assets.map((asset) => (_jsxs("div", { className: "trace-item", children: [_jsx("strong", { children: asset.path }), _jsx("span", { children: asset.unrealGuid })] }, asset.id)))] }), _jsxs("div", { children: [_jsx("h3", { children: "Commits" }), task?.commits.map((commit) => (_jsxs("div", { className: "trace-item", children: [_jsx("strong", { children: commit.message }), _jsx("span", { children: commit.hash.slice(0, 8) })] }, commit.hash)))] }), _jsxs("div", { children: [_jsx("h3", { children: "PRs" }), task?.prs.map((pr) => (_jsxs("div", { className: "trace-item", children: [_jsxs("strong", { children: ["#", pr.number] }), _jsx("span", { children: pr.title })] }, pr.id)))] })] })] }), _jsxs("article", { className: "detail-card", children: [_jsx("p", { className: "eyebrow", children: "Timeline" }), _jsx("h2", { children: "Recent activity" }), _jsx("div", { className: "timeline", children: task?.timeline.map((event) => (_jsxs("div", { className: "timeline-item", children: [_jsx("strong", { children: event.title }), _jsxs("span", { children: [event.type, " \u00B7 ", new Date(event.createdAt).toLocaleString()] })] }, event.id))) })] })] })] })] }));
}
