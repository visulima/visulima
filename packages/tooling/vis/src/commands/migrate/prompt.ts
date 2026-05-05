import { stdin, stdout } from "node:process";
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
