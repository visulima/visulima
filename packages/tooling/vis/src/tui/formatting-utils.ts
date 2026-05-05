import type { Task } from "@visulima/task-runner";

/**
 * Formats a single flag value for display.
 */
const formatValue = (value: unknown): string => {
    if (Array.isArray(value)) {
        return `[${value.join(",")}]`;
    }

    if (typeof value === "object" && value !== null) {
        return JSON.stringify(value);
    }

    return String(value);
};

/**
 * Formats a CLI flag for display output.
 * @param leftPad Padding string
 * @param flag The flag name
 * @param value The flag value
 */
export const formatFlags = (leftPad: string, flag: string, value: unknown): string => {
    // Positional arguments (the '_' key from minimist-style parsers)
    if (flag === "_") {
        return `${leftPad}${Array.isArray(value) ? (value as string[]).join(" ") : String(value)}`;
    }

    return `${leftPad}--${flag}=${formatValue(value)}`;
};

/**
 * Generates a human-readable description of the targets and projects being executed.
 *
 * Examples:
 * - "target build for project my-app".
 * - "targets build, test for 5 projects".
 * - "target build for 3 projects and 2 tasks they depend on".
 */
export const formatTargetsAndProjects = (projectNames: string[], targets: string[], tasks: Task[]): string => {
    const uniqueTargets = new Set(new Set(tasks.map((t) => t.target.target)));
    const uniqueProjects = new Set(new Set(tasks.map((t) => t.target.project)));

    // Filter to only targets/projects that are actually in the task list
    const matchedTargets = targets.filter((t) => uniqueTargets.has(t));
    const matchedProjects = projectNames.filter((p) => uniqueProjects.has(p));

    // Tasks that aren't directly requested (dependency tasks)
    const dependentTaskCount = tasks.length - matchedProjects.length * matchedTargets.length;

    const targetLabel = matchedTargets.length === 1 ? "target" : "targets";
    const targetList = matchedTargets.join(", ");

    const projectLabel = matchedProjects.length === 1 ? `project ${matchedProjects[0]}` : `${matchedProjects.length} projects`;

    let result = `${targetLabel} ${targetList} for ${projectLabel}`;

    if (dependentTaskCount > 0) {
        const taskWord = dependentTaskCount === 1 ? "task" : "tasks";
        const pronoun = dependentTaskCount === 1 ? "it depends" : "they depend";

        result += ` and ${dependentTaskCount} ${taskWord} ${pronoun} on`;
    }

    return result;
};
