import { cursorLeft, eraseLines } from "@visulima/ansi";
import { bold, cyan, dim, green, inverse, red, white } from "@visulima/colorize";
import type { TaskStatus } from "@visulima/task-runner";

import { CROSS, DASH, TICK } from "./symbols";

const EOL = "\n";

/**
 * CLI output utility for the VIS task runner TUI.
 *
 * Design language: industrial-utilitarian. Cyan accent for branding,
 * green/red for status. Restrained use of bold. Generous spacing.
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
     */
    public overwriteLines(numberLines: number, lines: string[]): void {
        if (numberLines > 0) {
            process.stdout.write(eraseLines(numberLines + 1));
            process.stdout.write(cursorLeft());
        }

        for (const line of lines) {
            process.stdout.write(line + EOL);
        }
    }

    /**
     * Gets a full-width thin separator line using box-drawing characters.
     */
    public getSeparator(): string {
        const width = process.stdout.columns || 80;

        return dim(DASH.repeat(width));
    }

    /**
     * Applies the VIS badge prefix to text.
     * Renders as: ` VIS ` inverse badge + space + text
     */
    public applyPrefix(colorFunction: (text: string) => string, text: string): string {
        const badge = inverse(bold(colorFunction(` ${this.#cliName} `)));

        return `${EOL}${badge}  ${text}${EOL}`;
    }

    /**
     * Logs task terminal output with formatting.
     * Uses GitHub Actions grouping when available.
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
            case "failure": {
                return red(CROSS);
            }
            case "local-cache":
            case "local-cache-kept-existing":
            case "remote-cache":
            case "success": {
                return green(TICK);
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
            case "failure": {
                return red(CROSS);
            }
            case "local-cache":
            case "local-cache-kept-existing":
            case "remote-cache": {
                return `${green(TICK)} ${cyan("[cache]")}`;
            }
            case "skipped": {
                return `${dim(DASH)} ${dim("[skipped]")}`;
            }
            case "success": {
                return green(TICK);
            }
            default: {
                return white("?");
            }
        }
    }

    /**
     * Returns a success message with VIS prefix badge.
     */
    public success(title: string, bodyLines?: string[]): string {
        let output = this.applyPrefix(green, title);

        if (bodyLines?.length) {
            output += bodyLines.map((l) => `  ${l}`).join(EOL) + EOL;
        }

        return output;
    }

    /**
     * Returns an error message with VIS prefix badge.
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
