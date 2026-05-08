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
 * Logs task terminal output with formatting.
 * Uses GitHub Actions grouping when available.
 */
export const logCommandOutputCI = (taskId: string, status: TaskStatus, output: string): void => {
    const trimmed = output.trim();

    if (!trimmed) {
        return;
    }

    const EOL = "\n";
    const isGitHubActions = process.env["GITHUB_ACTIONS"] === "true";

    if (isGitHubActions) {
        process.stdout.write(`::group::${getStatusIcon(status)} ${taskId}${EOL}`);
        process.stdout.write(trimmed + EOL);
        process.stdout.write(`::endgroup::${EOL}`);
    } else {
        const width = process.stdout.columns || 80;
        const separator = renderToString(React.createElement(Text, { dimColor: true }, DASH.repeat(width)), { columns: width }).trim();

        const prefix = getStatusPrefix(status);
        const boldTaskId = renderToString(React.createElement(Text, { bold: true }, taskId), { columns: width }).trim();

        process.stdout.write(`${separator}${EOL}`);
        process.stdout.write(`${prefix} ${boldTaskId}${EOL}`);
        process.stdout.write(trimmed + EOL);
        process.stdout.write(`${separator}${EOL}`);
    }
};
