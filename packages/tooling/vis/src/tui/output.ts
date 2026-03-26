import { cursorLeft, eraseLines } from "@visulima/ansi";
import { bold, cyan, dim, green, inverse, red, white } from "@visulima/colorize";

import type { TaskStatus } from "@visulima/task-runner";

import { DASH, TICK, CROSS } from "./symbols";

const EOL = "\n";

/**
 * CLI output utility for the VIS task runner TUI.
 * Provides formatted output with colors, separators, and cursor control.
 */
export class CLIOutput {
    readonly #cliName = "VIS";

    /**
     * Formats a task command for display.
     */
    public formatCommand(taskId: string): string {
        return `${dim("vis run ")}${taskId}`;
    }

    /**
     * Overwrites the current line(s) with new text.
     * Used for dynamic terminal updates.
     * @param numLines - Number of lines to erase before writing
     * @param lines - Lines to write
     */
    public overwriteLines(numLines: number, lines: string[]): void {
        if (numLines > 0) {
            process.stdout.write(eraseLines(numLines + 1));
            process.stdout.write(cursorLeft());
        }

        for (const line of lines) {
            process.stdout.write(line + EOL);
        }
    }

    /**
     * Gets a full-width separator line.
     */
    public getSeparator(): string {
        const width = process.stdout.columns || 80;

        return dim(DASH.repeat(width));
    }

    /**
     * Applies the VIS prefix to text with a given color function.
     */
    public applyPrefix(colorFunction: (text: string) => string, text: string): string {
        return `${EOL}${inverse(bold(colorFunction(` ${this.#cliName} `)))} ${text}${EOL}`;
    }

    /**
     * Logs task terminal output with appropriate formatting.
     * Supports GitHub Actions grouping.
     */
    public logCommandOutput(taskId: string, status: TaskStatus, output: string): void {
        const trimmed = output.trim();

        if (!trimmed) {
            return;
        }

        const isGitHubActions = process.env["GITHUB_ACTIONS"] === "true";

        if (isGitHubActions) {
            process.stdout.write(`::group::${this.getStatusIcon(status)} ${taskId}${EOL}`);
            process.stdout.write(trimmed + EOL);
            process.stdout.write(`::endgroup::${EOL}`);
        } else {
            process.stdout.write(`${this.getSeparator()}${EOL}`);
            process.stdout.write(`${this.getStatusPrefix(status)} ${bold(taskId)}${EOL}`);
            process.stdout.write(trimmed + EOL);
            process.stdout.write(`${this.getSeparator()}${EOL}`);
        }
    }

    /**
     * Gets the colored status icon for a task status.
     */
    public getStatusIcon(status: TaskStatus): string {
        switch (status) {
            case "success": {
                return green(TICK);
            }
            case "local-cache":
            case "local-cache-kept-existing":
            case "remote-cache": {
                return green(TICK);
            }
            case "failure": {
                return red(CROSS);
            }
            case "skipped": {
                return dim(DASH);
            }
            default: {
                return dim("?");
            }
        }
    }

    /**
     * Gets a colored prefix string for a status.
     */
    public getStatusPrefix(status: TaskStatus): string {
        switch (status) {
            case "success": {
                return green(TICK);
            }
            case "local-cache":
            case "local-cache-kept-existing":
            case "remote-cache": {
                return `${green(TICK)} ${cyan("[cache]")}`;
            }
            case "failure": {
                return red(CROSS);
            }
            case "skipped": {
                return `${dim(DASH)} ${dim("[skipped]")}`;
            }
            default: {
                return white("?");
            }
        }
    }

    /**
     * Returns a success message with VIS prefix.
     */
    public success(title: string, bodyLines?: string[]): string {
        let output = this.applyPrefix(green, title);

        if (bodyLines?.length) {
            output += bodyLines.map((l) => `  ${l}`).join(EOL) + EOL;
        }

        return output;
    }

    /**
     * Returns an error message with VIS prefix.
     */
    public error(title: string, bodyLines?: string[]): string {
        let output = this.applyPrefix(red, title);

        if (bodyLines?.length) {
            output += bodyLines.map((l) => `  ${l}`).join(EOL) + EOL;
        }

        return output;
    }
}

export const cliOutput: CLIOutput = new CLIOutput();
