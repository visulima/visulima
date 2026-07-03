import { stdin, stdout } from "node:process";
// eslint-disable-next-line n/no-unsupported-features/node-builtins -- readline/promises is stable as of Node 22.17; the engines range allows older 22.x but we ship in environments that have it
import { createInterface } from "node:readline/promises";

/** Prompt the user on stdin; returns true on y/yes (empty defaults to yes). */
export const confirm = async (question: string): Promise<boolean> => {
    if (!stdin.isTTY) {
        // No interactive TTY (CI, piped input): default to yes to avoid hanging.
        return true;
    }

    const rl = createInterface({ input: stdin, output: stdout });

    try {
        const raw = await rl.question(`${question} [Y/n] `);
        const answer = raw.trim().toLowerCase();

        return answer === "" || answer === "y" || answer === "yes";
    } finally {
        rl.close();
    }
};
