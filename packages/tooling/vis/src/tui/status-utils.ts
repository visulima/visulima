import { createHash } from "node:crypto";

import type { TaskStatus } from "@visulima/task-runner";
import { renderToString } from "@visulima/tui";
import { Text } from "@visulima/tui/components/text";
import React from "react";

import { CROSS, DASH, TICK } from "./symbols";

export const isCacheStatus = (status: string): boolean => status === "local-cache" || status === "local-cache-kept-existing" || status === "remote-cache";

export interface StatusInfo {
    color: string;
    icon: string;
}

export const getStatusInfo = (status: TaskStatus): StatusInfo => {
    switch (status) {
        case "failure": {
            return { color: "red", icon: CROSS };
        }
        case "local-cache":
        case "local-cache-kept-existing":
        case "remote-cache":
        case "success": {
            return { color: "green", icon: TICK };
        }
        case "skipped": {
            return { color: "gray", icon: DASH };
        }
        default: {
            return { color: "gray", icon: "?" };
        }
    }
};

/**
 * Returns the colored status icon as an ANSI string (for raw stdout writes).
 */
export const getStatusIcon = (status: TaskStatus): string => {
    const { color, icon } = getStatusInfo(status);

    return renderToString(React.createElement(Text, { color }, icon), { columns: 10 }).trim();
};

/**
 * Returns a colored prefix string for a status (for raw stdout writes).
 */
export const getStatusPrefix = (status: TaskStatus): string => {
    const { color, icon } = getStatusInfo(status);

    switch (status) {
        case "local-cache":
        case "local-cache-kept-existing":
        case "remote-cache": {
            return renderToString(
                React.createElement(Text, null, React.createElement(Text, { color }, icon), " ", React.createElement(Text, { color: "cyan" }, "[cache]")),
                { columns: 30 },
            ).trim();
        }
        case "skipped": {
            return renderToString(
                React.createElement(
                    Text,
                    null,
                    React.createElement(Text, { dimColor: true }, icon),
                    " ",
                    React.createElement(Text, { dimColor: true }, "[skipped]"),
                ),
                { columns: 30 },
            ).trim();
        }
        default: {
            return renderToString(React.createElement(Text, { color }, icon), { columns: 10 }).trim();
        }
    }
};

/**
 * CI grouping mode for {@link logCommandOutputCI}. Mirrors
 * `vis-config.ts → run.ciGrouping`. The runtime resolves `auto`
 * to a concrete format based on env vars (or `off` when no
 * supported runner is detected) before reaching the writer.
 */
export type CiGroupingMode = "auto" | "azure" | "buildkite" | "github" | "gitlab" | "off";

/** Concrete grouping format actually emitted by the writer. */
export type ResolvedCiGroupingMode = "azure" | "buildkite" | "github" | "gitlab" | "off";

/**
 * Resolves `auto` to the concrete grouping format implied by the
 * current environment. Off when no supported runner is detected so we
 * don't leak directive lines into a plain terminal.
 *
 * Detected runners (env var → mode):
 * - `GITHUB_ACTIONS=true` → `github`
 * - `GITLAB_CI=true` → `gitlab`
 * - `BUILDKITE=true` → `buildkite`
 * - `TF_BUILD=True` (Pascal-case, set by Azure Pipelines) → `azure`
 *
 * CircleCI is intentionally not auto-detected: its 2.0+ format has
 * no inline grouping directive (steps auto-group in the web UI).
 */
export const resolveCiGroupingMode = (mode: CiGroupingMode | undefined): ResolvedCiGroupingMode => {
    if (mode === "azure" || mode === "buildkite" || mode === "github" || mode === "gitlab" || mode === "off") {
        return mode;
    }

    if (process.env["GITHUB_ACTIONS"] === "true") {
        return "github";
    }

    if (process.env["GITLAB_CI"] === "true") {
        return "gitlab";
    }

    if (process.env["BUILDKITE"] === "true") {
        return "buildkite";
    }

    // Azure Pipelines exports TF_BUILD with a Pascal-case "True" — match
    // case-insensitively to be safe across agents that normalise the value.
    if (process.env["TF_BUILD"]?.toLowerCase() === "true") {
        return "azure";
    }

    return "off";
};

/**
 * Builds a GitLab section key safe for the section_start/section_end
 * ANSI directives. GitLab requires `[A-Za-z0-9_]+` and uses the same
 * key on both ends, so we slugify aggressively. A short hash of the
 * original task id is appended so distinct ids that slugify to the
 * same string (e.g. `app:test` and `app_test`) don't collide and
 * collapse into one another's sections in the web UI.
 */
const toGitLabSectionKey = (taskId: string): string => {
    const slug = taskId.replaceAll(/\W+/g, "_");
    const hash = createHash("sha256").update(taskId).digest("hex").slice(0, 6);

    return `${slug}_${hash}`;
};

/**
 * Logs task terminal output with formatting. Wraps the output in the
 * appropriate CI log group when grouping is enabled — failed tasks are
 * intentionally left expanded so the failure is visible without an
 * extra click. Pass `mode` from `vis-config.ts → run.ciGrouping`;
 * `auto` (the default) detects the runner via env vars.
 */
export const logCommandOutputCI = (taskId: string, status: TaskStatus, output: string, mode: CiGroupingMode | undefined = "auto"): void => {
    const trimmed = output.trim();

    if (!trimmed) {
        return;
    }

    const EOL = "\n";
    const grouping = resolveCiGroupingMode(mode);

    // GitHub log groups are always collapsible (and collapsed by default) —
    // there is no "expanded group" directive — so we wrap *every* task,
    // failures included, in a `::group::`. Leaving a failure ungrouped would
    // break the one-group-per-task structure and dump raw separators into an
    // otherwise tidy log; the failed task's group sits at the tail of the log
    // and is a single click away.
    if (grouping === "github") {
        process.stdout.write(`::group::${getStatusIcon(status)} ${taskId}${EOL}`);
        process.stdout.write(trimmed + EOL);
        process.stdout.write(`::endgroup::${EOL}`);

        return;
    }

    if (grouping === "gitlab") {
        // Each directive carries its own timestamp so the GitLab UI can
        // compute the section's runtime; reusing one timestamp would lie
        // about how long output spent inside the block.
        const startTs = Math.floor(Date.now() / 1000);
        const key = toGitLabSectionKey(taskId);
        // Successful sections collapse to keep the log compact; a failed
        // task's section is left expanded (omit `[collapsed=true]`) so the
        // error is visible without expanding it. Unlike GitHub, GitLab *can*
        // render a grouped-but-expanded section, so failures stay grouped.
        const collapsed = status === "failure" ? "" : "[collapsed=true]";
        // ANSI CSI "Erase In Line" — GitLab strips the cursor-positioning
        // bytes from the rendered log so the directive itself stays hidden.
        const eraseLine = "[0K";

        process.stdout.write(`${eraseLine}section_start:${String(startTs)}:${key}${collapsed}\r${eraseLine}${getStatusIcon(status)} ${taskId}${EOL}`);
        process.stdout.write(trimmed + EOL);

        const endTs = Math.floor(Date.now() / 1000);

        process.stdout.write(`${eraseLine}section_end:${String(endTs)}:${key}\r${eraseLine}${EOL}`);

        return;
    }

    if (grouping === "buildkite") {
        // Buildkite has no explicit "end group" directive — the next
        // `---` / `+++` / `~~~` line implicitly closes the previous block.
        // `---` folds the section; `+++` forces it open, so — like GitLab —
        // a failed task is expanded by default while successes stay folded.
        const heading = status === "failure" ? "+++" : "---";

        process.stdout.write(`${heading} ${getStatusIcon(status)} ${taskId}${EOL}`);
        process.stdout.write(trimmed + EOL);

        return;
    }

    if (grouping === "azure") {
        // Azure Pipelines only offers a collapsed `##[group]` — there is no
        // expanded-group directive — so, like GitHub, a failed task is
        // grouped collapsed and sits one click from the error.
        process.stdout.write(`##[group]${getStatusIcon(status)} ${taskId}${EOL}`);
        process.stdout.write(trimmed + EOL);
        process.stdout.write(`##[endgroup]${EOL}`);

        return;
    }

    const width = process.stdout.columns || 80;
    const separator = renderToString(React.createElement(Text, { dimColor: true }, DASH.repeat(width)), { columns: width }).trim();

    const prefix = getStatusPrefix(status);
    const boldTaskId = renderToString(React.createElement(Text, { bold: true }, taskId), { columns: width }).trim();

    process.stdout.write(`${separator}${EOL}`);
    process.stdout.write(`${prefix} ${boldTaskId}${EOL}`);
    process.stdout.write(trimmed + EOL);
    process.stdout.write(`${separator}${EOL}`);
};
