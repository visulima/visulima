/**
 * Interactive prompts for `vis create`.
 *
 * Uses `node:readline` (same pattern as `vis init`) to keep dependencies minimal.
 */

import { resolve } from "node:path";
import { createInterface } from "node:readline";

import { bold, cyan, dim } from "../../output";
import { randomName } from "./random-name";
import { isEmptyDir, isValidPackageName, toValidPackageName } from "./utils";

// ── Low-level prompt helpers ──────────────────────────────────────

type RL = ReturnType<typeof createInterface>;

const ask = (rl: RL, question: string): Promise<string> =>
    new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer.trim());
        });
    });

const confirm = async (rl: RL, question: string, defaultYes: boolean = true): Promise<boolean> => {
    const hint = defaultYes ? "[Y/n]" : "[y/N]";
    const answer = await ask(rl, `  ${question} ${dim(hint)} `);

    if (answer === "") {
        return defaultYes;
    }

    return answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";
};

const select = async (rl: RL, question: string, choices: { hint?: string; label: string; value: string }[]): Promise<string> => {
    process.stderr.write(`  ${question}\n`);

    for (const [index, choice] of choices.entries()) {
        const num = bold(cyan(`  ${String(index + 1)}.`));
        const hint = choice.hint ? dim(` — ${choice.hint}`) : "";

        process.stderr.write(`${num} ${choice.label}${hint}\n`);
    }

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const answer = await ask(rl, `\n  ${dim("Enter choice (1-" + String(choices.length) + "):")} `);
        const num = Number.parseInt(answer, 10);

        if (num >= 1 && num <= choices.length) {
            return (choices[num - 1] as { value: string }).value;
        }

        // Also accept typing the value directly
        const match = choices.find((c) => c.value === answer || c.label.toLowerCase() === answer.toLowerCase());

        if (match) {
            return match.value;
        }

        process.stderr.write(`  ${dim("Invalid choice. Try again.")}\n`);
    }
};

// ── High-level prompt flows ───────────────────────────────────────

export interface PromptResult {
    editor?: "vscode" | undefined;
    gitInit: boolean;
    pm?: "bun" | "npm" | "pnpm" | "yarn" | undefined;
    projectName: string;
    targetDir: string;
    template: string;
}

/**
 * Run the full interactive prompt flow and return the collected answers.
 */
export const runInteractivePrompts = async (options: {
    cwd: string;
    defaultPm?: string;
    inMonorepo: boolean;
}): Promise<PromptResult> => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });

    try {
        process.stderr.write(`\n  ${bold(cyan("vis create"))} ${dim("— project scaffolding")}\n\n`);

        // 1. Template selection
        const templateChoices = options.inMonorepo
            ? [
                  { hint: "Scaffold via create-vite", label: "Vis Application", value: "vis:app" },
                  { hint: "Reusable package scaffold", label: "Vis Library", value: "vis:library" },
                  { hint: "Code generator scaffold", label: "Vis Generator", value: "vis:generator" },
                  { hint: "Enter an npm create-* package or GitHub URL", label: "Custom template", value: "__custom__" },
              ]
            : [
                  { hint: "Full workspace setup", label: "Vis Monorepo", value: "vis:monorepo" },
                  { hint: "Scaffold via create-vite", label: "Vis Application", value: "vis:app" },
                  { hint: "Reusable package scaffold", label: "Vis Library", value: "vis:library" },
                  { hint: "Enter an npm create-* package or GitHub URL", label: "Custom template", value: "__custom__" },
              ];

        let template = await select(rl, "Select a template:", templateChoices);

        if (template === "__custom__") {
            template = await ask(rl, `\n  ${dim("Template (npm package or GitHub URL):")} `);

            if (!template) {
                throw new Error("No template specified.");
            }
        }

        // 2. Project name
        const suggestion = randomName();
        const nameAnswer = await ask(rl, `\n  ${dim(`Project name (${suggestion}):`)} `);
        const projectName = nameAnswer || suggestion;

        if (!isValidPackageName(toValidPackageName(projectName))) {
            throw new Error(`Invalid project name: "${projectName}". Must be a valid npm package name.`);
        }

        // 3. Target directory
        const defaultDir = toValidPackageName(projectName);
        const dirAnswer = await ask(rl, `  ${dim(`Target directory (${defaultDir}):`)} `);
        const targetDir = dirAnswer || defaultDir;

        // 4. Overwrite check
        const fullPath = resolve(options.cwd, targetDir);

        if (!isEmptyDir(fullPath)) {
            const overwrite = await confirm(rl, `Directory "${targetDir}" is not empty. Overwrite?`, false);

            if (!overwrite) {
                throw new Error("Aborted — directory not empty.");
            }
        }

        // 5. Package manager (skip if in monorepo — monorepo PM is already set)
        let pm: "bun" | "npm" | "pnpm" | "yarn" | undefined;

        if (!options.inMonorepo) {
            if (options.defaultPm) {
                // Config pre-selected a PM — use it without prompting
                pm = options.defaultPm as "bun" | "npm" | "pnpm" | "yarn";
                process.stderr.write(`  ${dim(`Package manager: ${pm} (from config)`)}\n`);
            } else {
                const pmChoice = await select(rl, "Package manager:", [
                    { label: "pnpm", value: "pnpm" },
                    { label: "npm", value: "npm" },
                    { label: "yarn", value: "yarn" },
                    { label: "bun", value: "bun" },
                ]);

                pm = pmChoice as "bun" | "npm" | "pnpm" | "yarn";
            }
        }

        // 6. Git init (standalone only)
        let gitInit = false;

        if (!options.inMonorepo) {
            gitInit = await confirm(rl, "Initialize a git repository?");
        }

        // 7. Editor config
        const editor = (await confirm(rl, "Generate VS Code configuration?"))
            ? ("vscode" as const)
            : undefined;

        process.stderr.write("\n");

        return { editor, gitInit, pm, projectName, targetDir, template };
    } finally {
        rl.close();
    }
};
