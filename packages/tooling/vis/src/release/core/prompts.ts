/**
 * Minimal readline-based prompts. Matches the rest of vis (which uses
 * node:readline rather than `@clack/prompts`) to keep the dep tree small.
 *
 * If you want richer UI (arrow-key selection, etc.) consider importing
 * a richer prompt lib in your own handler — these helpers cover the
 * "yes/no" + "pick from list" + "free text" cases used by `vis release add`
 * and `vis release init`.
 */

import { createInterface } from "node:readline";

import { dim } from "@visulima/colorize";

const ask = (rl: ReturnType<typeof createInterface>, question: string): Promise<string> =>
    new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer.trim());
        });
    });

export const confirmPrompt = async (question: string, defaultYes: boolean = true): Promise<boolean> => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });

    try {
        const hint = defaultYes ? "[Y/n]" : "[y/N]";
        const answer = await ask(rl, `${question} ${dim(hint)} `);

        if (answer === "") {
            return defaultYes;
        }

        return /^y(?:es)?$/i.test(answer);
    } finally {
        rl.close();
    }
};

export const textPrompt = async (question: string, defaultValue: string = ""): Promise<string> => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });

    try {
        const hint = defaultValue ? ` ${dim(`(${defaultValue})`)}` : "";
        const answer = await ask(rl, `${question}${hint} `);

        return answer === "" ? defaultValue : answer;
    } finally {
        rl.close();
    }
};

export const selectPrompt = async <T extends string>(question: string, options: ReadonlyArray<{ label: string; value: T }>): Promise<T> => {
    if (options.length === 0) {
        throw new Error("selectPrompt called with no options.");
    }

    const rl = createInterface({ input: process.stdin, output: process.stdout });

    try {
        process.stdout.write(`${question}\n`);

        for (const [index, option] of options.entries()) {
            process.stdout.write(`  ${index + 1}) ${option.label}\n`);
        }

        while (true) {
            const answer = await ask(rl, dim(`  [1-${options.length}] `));
            const index = Number.parseInt(answer, 10);

            if (!Number.isNaN(index) && index >= 1 && index <= options.length) {
                return options[index - 1]!.value;
            }

            process.stdout.write(dim(`  Please enter a number between 1 and ${options.length}.\n`));
        }
    } finally {
        rl.close();
    }
};

export const multiSelectPrompt = async <T extends string>(question: string, options: ReadonlyArray<{ label: string; value: T }>): Promise<T[]> => {
    if (options.length === 0) {
        throw new Error("multiSelectPrompt called with no options.");
    }

    const rl = createInterface({ input: process.stdin, output: process.stdout });

    try {
        process.stdout.write(`${question}\n`);

        for (const [index, option] of options.entries()) {
            process.stdout.write(`  ${index + 1}) ${option.label}\n`);
        }

        while (true) {
            const answer = await ask(rl, dim("  Comma-separated indices (e.g. 1,3,4): "));
            const parts = answer
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
            const indices = parts.map((s) => Number.parseInt(s, 10));

            if (indices.every((index) => !Number.isNaN(index) && index >= 1 && index <= options.length)) {
                return indices.map((index) => options[index - 1]!.value);
            }

            process.stdout.write(dim(`  Please enter comma-separated numbers between 1 and ${options.length}.\n`));
        }
    } finally {
        rl.close();
    }
};
