export interface Project {
    id: string;
    teamId: string;
    name: string;
    repoMappings: string[];
}
export interface Task {
    id: string;
    projectId: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    assignees: string[];
    linkedCommits: string[];
    linkedAssets: string[];
    linkedPRs: string[];
}
export interface TimelineEvent {
    id: string;
    type: string;
    title: string;
    createdAt: string;
}
export interface TaskDetails extends Task {
    commits: Array<{
        hash: string;
        message: string;
        author: string;
    }>;
    assets: Array<{
        id: string;
        path: string;
        unrealGuid: string;
        snapshotUrl?: string;
    }>;
    prs: Array<{
        id: string;
        number: number;
        title: string;
        status: string;
    }>;
    timeline: TimelineEvent[];
}
