/**
 * Shared interactive-prompt primitives.
 *
 * Canonical readline + yes/no helpers reused by the marshall decision prompt
 * and the dlx first-run gate. Keeping a single implementation avoids the
 * "answer === 'y' || answer === 'yes'" pattern drifting across call sites.
 */

import { createInterface } from "node:readline";

/**
 * Read a single trimmed, lower-cased line from stdin.
 * @param question The prompt text written before reading the answer.
 * @returns The user's response, trimmed and lower-cased.
 */
export const defaultReadline = async (question: string): Promise<string> => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });

    try {
        return await new Promise<string>((resolve) => {
            rl.question(question, (answer) => {
                resolve(answer.trim().toLowerCase());
            });
        });
    } finally {
        rl.close();
    }
};

/**
 * Prompt a yes/no question; defaults to No on anything other than `y`/`yes`.
 * @param question The prompt text shown to the user.
 * @param readline Line reader used to collect the answer. Defaults to
 * {@link defaultReadline}; a custom reader need not pre-normalize its output.
 * @returns `true` when the (trimmed, lower-cased) answer is `y` or `yes`.
 */
export const promptYesNo = async (question: string, readline: (question: string) => Promise<string> = defaultReadline): Promise<boolean> => {
    const answer = await readline(question);
    const normalized = answer.trim().toLowerCase();

    return normalized === "y" || normalized === "yes";
};
