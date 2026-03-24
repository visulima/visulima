// CLI
export { parseArgs, run } from "./cli";
export type { ParsedArgs } from "./cli";

// Workspace discovery
export { buildProjectGraph, discoverWorkspace, findWorkspaceRoot, readVisConfig, resolveWorkspacePatterns } from "./workspace";
export type { PackageJson, VisConfig } from "./workspace";

// Commands
export { runCommand } from "./commands/run";
export { graphCommand } from "./commands/graph";
export { affectedCommand } from "./commands/affected";

// Re-export key types from task-runner for convenience
export type {
    ProjectConfiguration,
    ProjectGraph,
    Task,
    TaskGraph,
    TaskResult,
    TaskResults,
    TaskRunnerOptions,
    TaskStatus,
    WorkspaceConfiguration,
} from "@visulima/task-runner";
