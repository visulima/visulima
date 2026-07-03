/**
 * Teardown flow controller.
 *
 * Runs cleanup commands sequentially after all concurrent processes complete.
 * Each teardown command inherits stdio (output goes directly to terminal).
 *
 * Commands are sourced from configuration (trusted, not user input).
 * Shell execution is intentional for pipe/redirect support.
 */

import { spawn } from "node:child_process";

import { withEnhancedPath } from "../path-utils";

export interface TeardownOptions {
    /** Commands to run in sequence after all processes complete. */
    commands: string[];
    /** Working directory for teardown commands. */
    cwd?: string;
}

/**
 * Run teardown commands sequentially.
 * Each command runs in the shell with inherited stdio.
 * If a command fails, subsequent commands are still attempted.
 * @returns Array of exit codes for each teardown command
 */
export const runTeardown = async (options: TeardownOptions): Promise<number[]> => {
    const { commands, cwd } = options;
    const results: number[] = [];

    for (const command of commands) {
        // eslint-disable-next-line no-await-in-loop -- intentionally sequential
        const code = await runTeardownCommand(command, cwd);

        results.push(code);
    }

    return results;
};

/**
 * Run a single teardown command with inherited stdio.
 * Commands originate from vis.config teardown (trusted).
 */
const runTeardownCommand = (command: string, cwd?: string): Promise<number> =>
    new Promise((resolve) => {
        const shellProgram = process.platform === "win32" ? "cmd.exe" : "/bin/sh";
        const shellArgs = process.platform === "win32" ? ["/s", "/c", `"${command}"`] : ["-c", command];

        const child = spawn(shellProgram, shellArgs, {
            cwd,
            // Teardown commands come from vis.config and historically
            // ran via package-manager scripts (where node_modules/.bin
            // is already on PATH). Match that contract so a teardown
            // like `vitest --reporter=json` resolves without the user
            // having to spell out `pnpm exec`.
            env: withEnhancedPath(process.env, cwd ?? process.cwd()),
            stdio: "inherit",
            windowsVerbatimArguments: process.platform === "win32",
        });

        child.on("close", (code) => {
            resolve(code ?? 1);
        });

        child.on("error", () => {
            resolve(1);
        });
    });
