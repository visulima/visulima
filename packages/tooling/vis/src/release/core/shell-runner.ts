/**
 * Default `CommandRunner` implementation using `tinyexec` — vis's
 * subprocess primitive elsewhere in the codebase.
 *
 * Centralises subprocess execution so tests can swap in a mock without
 * touching every adapter (matches bumpy's `_setInterceptor` pattern).
 *
 * **Token redaction (RFC §19.4):** captured stdout/stderr are run through
 * `redactTokens` before they're surfaced to callers. This stops Bearer,
 * npm_* / ghp_* / ACTIONS_ID_TOKEN_REQUEST_TOKEN from leaking into log
 * output when a downstream printer dumps `result.stdout`. Inherited stdio
 * (non-silent mode) bypasses this — it streams direct to the user's
 * terminal — so any subprocess that emits secrets to stdout in non-silent
 * mode would still leak. The mitigation there is to use silent mode for
 * any auth-touching command (npm view, npm publish via runner, OIDC
 * token-exchange via fetch).
 */

import { x } from "tinyexec";

import type { CommandRunner } from "./package-managers/interface";
import { redactTokens } from "./security";

export const createShellRunner = (): CommandRunner => {
    return {
        run: async (command, args, options) => {
            try {
                const result = await x(command, [...args], {
                    nodeOptions: {
                        cwd: options.cwd,
                        env: {
                            ...process.env,
                            // Never block on corepack's interactive "Do you want to
                            // download <pm>@<version>?" prompt. vis runs subprocesses
                            // non-interactively and silent mode ignores stdin, so the
                            // prompt would wait on EOF forever — observed as a 30s+
                            // hang on Windows CI when a fixture pins a packageManager
                            // version corepack must resolve. `0` makes corepack proceed
                            // without prompting instead of hanging.
                            COREPACK_ENABLE_DOWNLOAD_PROMPT: "0",
                            ...options.env,
                        },
                        stdio: options.silent ? ["ignore", "pipe", "pipe"] : "inherit",
                    },
                    throwOnError: false,
                });

                return {
                    exitCode: typeof result.exitCode === "number" ? result.exitCode : -1,
                    stderr: redactTokens(result.stderr ?? ""),
                    stdout: redactTokens(result.stdout ?? ""),
                };
            } catch (error) {
                return {
                    exitCode: -1,
                    stderr: redactTokens((error as Error).message),
                    stdout: "",
                };
            }
        },
    };
};

/**
 * In-process mock runner for tests. Matches every (command, args) prefix
 * against a registered handler; falls back to a default if none matches.
 */
export const createMockRunner = (): MockRunner => new MockRunner();

export class MockRunner implements CommandRunner {
    private readonly handlers: {
        argsPrefix: ReadonlyArray<string>;
        command: string;
        respond: (cwd: string) => { exitCode: number; stderr: string; stdout: string };
    }[] = [];

    public on(command: string, argsPrefix: ReadonlyArray<string>, respond: (cwd: string) => { exitCode: number; stderr: string; stdout: string }): void {
        this.handlers.push({ argsPrefix, command, respond });
    }

    public async run(command: string, args: ReadonlyArray<string>, options: { cwd: string }): Promise<{ exitCode: number; stderr: string; stdout: string }> {
        for (const handler of this.handlers) {
            if (handler.command !== command) {
                continue;
            }

            if (args.length < handler.argsPrefix.length) {
                continue;
            }

            const matches = handler.argsPrefix.every((value, index) => value === args[index]);

            if (matches) {
                return handler.respond(options.cwd);
            }
        }

        return { exitCode: 0, stderr: "", stdout: "" };
    }
}
