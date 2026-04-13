import type { Project, TaskDetails } from "./types";
export declare function getMe(): Promise<any>;
export declare function getProjects(): Promise<Project[]>;
export declare function getProject(id: string): Promise<any>;
export declare function getTask(id: string): Promise<TaskDetails>;
