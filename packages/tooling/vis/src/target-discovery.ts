import { createInterface } from "node:readline";

import type { WorkspaceConfiguration } from "@visulima/task-runner";

import type { ProjectOptionsIndex } from "./workspace";

/**
 * Collects every unique target name across all projects in the workspace.
 * @param workspace The discovered workspace configuration.
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
 * Builds a `{alias → canonicalTargetName}` lookup from declared
 * `aliases` on any `VisTargetConfiguration` in the workspace. Aliases
 * are treated as workspace-global — the first declaration wins and
 * later ones are silently ignored (prefer explicit canonical names
 * when aliases collide).
 *
 * Canonical target names themselves are not added to the map — only
 * declared aliases — so `resolveTargetAlias` leaves non-alias input
 * unchanged.
 */
export const buildAliasMap = (projectOptions: ProjectOptionsIndex): Map<string, string> => {
    const aliases = new Map<string, string>();

    for (const visTargets of projectOptions.values()) {
        for (const [canonical, config] of Object.entries(visTargets)) {
            for (const alias of config.aliases ?? []) {
                if (!aliases.has(alias)) {
                    aliases.set(alias, canonical);
                }
            }
        }
    }

    return aliases;
};

/**
 * Resolves a user-typed target name to its canonical form, or returns
 * the input unchanged when no alias matches.
 */
export const resolveTargetAlias = (name: string, aliases: Map<string, string>): string => aliases.get(name) ?? name;

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

            matrix[i]![j] = Math.min(matrix[i - 1]![j]! + 1, matrix[i]![j - 1]! + 1, matrix[i - 1]![j - 1]! + cost);
        }
    }

    return matrix[b.length]![a.length]!;
};

/**
 * Suggests the closest matching target name for a typo.
 * @param input The unknown target name the user typed.
 * @param available Known target names.
 * @param maxDistance Maximum edit distance to consider (default 3).
 * @returns The best match, or `undefined` if nothing is close enough.
 */
export const suggestTarget = (input: string, available: string[], maxDistance = 3): string | undefined => suggestTargets(input, available, 1, maxDistance)[0];

/**
 * Returns up to `limit` closest-matching target names within
 * `maxDistance` edit distance, sorted by ascending distance.
 *
 * Used by the missing-target error output to offer several candidates
 * — one suggestion often reads as authoritative, three reads as
 * "pick whichever you meant", which is friendlier at scale.
 */
export const suggestTargets = (input: string, available: string[], limit = 3, maxDistance = 3): string[] => {
    const scored: { distance: number; name: string }[] = [];

    for (const candidate of available) {
        const distance = levenshtein(input.toLowerCase(), candidate.toLowerCase());

        if (distance <= maxDistance) {
            scored.push({ distance, name: candidate });
        }
    }

    scored.sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name));

    return scored.slice(0, limit).map((s) => s.name);
};

/**
 * Formats the available targets list for display.
 * @param targets Sorted target names.
 * @returns Formatted string for CLI output.
 */
export const formatTargetList = (targets: string[]): string => {
    if (targets.length === 0) {
        return "  (no targets found)";
    }

    return targets.map((t) => `  - ${t}`).join("\n");
};

/**
 * Prompts the user to pick a target from `targets` via an interactive
 * numbered readline prompt. Accepts either the index (1-based) or the
 * target name; empty input or Ctrl-C aborts with `undefined`.
 *
 * Uses Node's built-in readline rather than a TUI dependency — this
 * keeps the bare `vis run` flow lightweight and works in any TTY.
 * Mirrors vite-task's `vp run` (no args) interactive selector.
 * @returns The chosen target name, or `undefined` if the user aborts.
 */
export const promptTargetInteractively = async (targets: string[]): Promise<string | undefined> => {
    if (targets.length === 0) {
        return undefined;
    }

    if (!process.stdin.isTTY || !process.stdout.isTTY) {
        return undefined;
    }

    const rl = createInterface({ input: process.stdin, output: process.stdout });

    try {
        process.stdout.write("Available targets:\n");

        for (const [index, name] of targets.entries()) {
            process.stdout.write(`  ${String(index + 1).padStart(2, " ")}. ${name}\n`);
        }

        process.stdout.write("\n");

        const answer = await new Promise<string>((resolve) => {
            rl.question("Select a target (number or name, blank to cancel): ", resolve);
        });

        const trimmed = answer.trim();

        if (trimmed.length === 0) {
            return undefined;
        }

        const asIndex = Number.parseInt(trimmed, 10);

        if (Number.isFinite(asIndex) && asIndex >= 1 && asIndex <= targets.length) {
            return targets[asIndex - 1];
        }

        if (targets.includes(trimmed)) {
            return trimmed;
        }

        return suggestTarget(trimmed, targets);
    } finally {
        rl.close();
    }
};
