/**
 * Input handler flow controller.
 *
 * Routes stdin data to specific child processes based on a prefix pattern.
 * Input prefixed with "name:" or "index:" is routed to that command's stdin.
 * Unprefixed input goes to the default target (index 0).
 *
 * NOTE: This module does NOT execute commands -- it only pipes user-typed
 * stdin data to already-running child process stdin streams. No shell
 * invocation or command injection risk.
 *
 * LIMITATION: This is a standalone utility -- it is NOT integrated into
 * runConcurrently() because the concurrent runner does not expose child
 * stdin streams. To use this, spawn processes manually with stdin: "pipe"
 * and pass the writable streams to createInputHandler().
 *
 * TODO: To fully integrate stdin routing into runConcurrently(), we would need:
 * 1. A new "started" ProcessEvent that carries a writable stdin reference
 * 2. On the Rust side: expose tokio::process::ChildStdin through NAPI
 *    (requires a custom wrapper since ChildStdin can't cross FFI directly)
 * 3. In the JS fallback: return child.stdin from spawnCommand()
 */

import type { Readable, Writable } from "node:stream";

export interface InputHandlerOptions {
    /** Default command index to route unprefixed input to. Default: 0. */
    defaultTarget?: number;
    /** Stream to read input from. Default: process.stdin. */
    inputStream?: Readable;
    /** Whether to pause the input stream when all processes finish. Default: true. */
    pauseOnFinish?: boolean;
}

interface CommandStdin {
    index: number;
    name?: string;
    stdin: Writable;
}

const INPUT_PREFIX_REGEX = /^(\S+?):(.+)/s;

/**
 * Creates an input handler that routes stdin to child processes.
 * @param commands Map of command index/name to their stdin streams
 * @param options Input handler configuration
 * @returns cleanup function to call when done
 */
export const createInputHandler = (commands: CommandStdin[], options: InputHandlerOptions = {}): (() => void) => {
    const { defaultTarget = 0, inputStream = process.stdin, pauseOnFinish = true } = options;

    // Build lookup maps
    const byIndex = new Map<number, CommandStdin>();
    const byName = new Map<string, CommandStdin>();

    for (const cmd of commands) {
        byIndex.set(cmd.index, cmd);

        if (cmd.name) {
            byName.set(cmd.name, cmd);
        }
    }

    const onData = (data: Buffer): void => {
        const input = data.toString();
        const match = INPUT_PREFIX_REGEX.exec(input);

        if (match) {
            const [, target, rest] = match;
            const targetCmd = byName.get(target!) ?? byIndex.get(Number(target));

            if (targetCmd) {
                targetCmd.stdin.write(rest);

                return;
            }
        }

        // Route to default target
        const defaultCmd = byIndex.get(defaultTarget);

        if (defaultCmd) {
            defaultCmd.stdin.write(input);
        }
    };

    inputStream.on("data", onData);

    // Return cleanup function
    return () => {
        inputStream.removeListener("data", onData);

        if (pauseOnFinish && typeof inputStream.pause === "function") {
            inputStream.pause();
        }
    };
};
