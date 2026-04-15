import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

/** Prompt the user on stdin; returns true on y/yes (empty defaults to yes). */
export const confirm = async (question: string): Promise<boolean> => {
    if (!stdin.isTTY) {
        // No interactive TTY (CI, piped input): default to yes to avoid hanging.
        return true;
    }

    const rl = createInterface({ input: stdin, output: stdout });

    try {
        const answer = (await rl.question(`${question} [Y/n] `)).trim().toLowerCase();

        if (answer === "" || answer === "y" || answer === "yes") return true;

        return false;
    } finally {
        rl.close();
    }
};
