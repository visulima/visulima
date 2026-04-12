import type { WorkspaceConfiguration } from "@visulima/task-runner";

/**
 * Collects every unique target name across all projects in the workspace.
 *
 * @param workspace - The discovered workspace configuration.
 * @returns Sorted array of unique target names.
 */
export const collectAvailableTargets = (workspace: WorkspaceConfiguration): string[] => {
    const targets = new Set<string>();

    for (const project of Object.values(workspace.projects)) {
        for (const name of Object.keys(project.targets ?? {})) {
            targets.add(name);
        }
    }

    return [...targets].sort();
};

/**
 * Computes the Levenshtein distance between two strings.
 */
const levenshtein = (a: string, b: string): number => {
    if (a.length === 0) {
        return b.length;
    }

    if (b.length === 0) {
        return a.length;
    }

    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0]![j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            const cost = b[i - 1] === a[j - 1] ? 0 : 1;

            matrix[i]![j] = Math.min(
                matrix[i - 1]![j]! + 1,
                matrix[i]![j - 1]! + 1,
                matrix[i - 1]![j - 1]! + cost,
            );
        }
    }

    return matrix[b.length]![a.length]!;
};

/**
 * Suggests the closest matching target name for a typo.
 *
 * @param input - The unknown target name the user typed.
 * @param available - Known target names.
 * @param maxDistance - Maximum edit distance to consider (default 3).
 * @returns The best match, or `undefined` if nothing is close enough.
 */
export const suggestTarget = (input: string, available: string[], maxDistance = 3): string | undefined => {
    let best: string | undefined;
    let bestDistance = maxDistance + 1;

    for (const candidate of available) {
        const distance = levenshtein(input.toLowerCase(), candidate.toLowerCase());

        if (distance < bestDistance) {
            bestDistance = distance;
            best = candidate;
        }
    }

    return best;
};

/**
 * Formats the available targets list for display.
 *
 * @param targets - Sorted target names.
 * @returns Formatted string for CLI output.
 */
export const formatTargetList = (targets: string[]): string => {
    if (targets.length === 0) {
        return "  (no targets found)";
    }

    return targets.map((t) => `  - ${t}`).join("\n");
};
