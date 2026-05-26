import type { Interface as ReadlineInterface } from "node:readline";
import { createInterface } from "node:readline";

import { isBreakingUpdate } from "./report";
import type { EcosystemUpdate } from "./types";

export interface PromptIO {
    /** Reads a single line answer; the prompt string is written verbatim. */
    readonly ask: (question: string) => Promise<string>;
    /** Closes any open resources held by the IO impl. */
    readonly close: () => void;
    /** Echoes a line to the user; used to render the numbered list. */
    readonly write: (line: string) => void;
}

const createReadlineIO = (): PromptIO => {
    const rl: ReadlineInterface = createInterface({ input: process.stdin, output: process.stdout });

    return {
        ask: (question) =>
            new Promise((resolve) => {
                rl.question(question, (answer) => {
                    resolve(answer.trim());
                });
            }),
        close: () => {
            rl.close();
        },
        write: (line) => {
            process.stdout.write(`${line}\n`);
        },
    };
};

const parseIndexSelection = (raw: string, length: number): number[] => raw
    .split(",")
    .map((part) => Number.parseInt(part.trim(), 10) - 1)
    .filter((index) => Number.isInteger(index) && index >= 0 && index < length);

/**
 * Interactive selector for ecosystem updates. Mirrors the npm-side
 * `promptPackageSelection`: lists every update with a 1-based index and
 * asks which to apply.
 *
 * Choices:
 *   - "a" / "all"      apply everything
 *   - "s" / "safe"     apply only non-breaking (minor/patch/digest/pin) updates
 *   - "n" / "none"     apply nothing
 *   - numeric list     comma-separated indices to apply
 *
 * An unrecognised answer defaults to "none" — the safer of the two
 * options when the user's intent is ambiguous.
 */
export const promptEcosystemSelection = async (
    updates: EcosystemUpdate[],
    io: PromptIO = createReadlineIO(),
): Promise<EcosystemUpdate[]> => {
    if (updates.length === 0) {
        io.close();

        return [];
    }

    io.write("");
    io.write("Outdated ecosystem references:");

    for (const [index, update] of updates.entries()) {
        const from = update.currentVersion ?? update.currentRef;
        const to = update.newVersion ?? update.newRef;
        const breakingTag = isBreakingUpdate(update) ? " [BREAKING]" : "";

        io.write(`  ${String(index + 1)}. [${update.ecosystem}] ${update.name}: ${from} → ${to} (${update.updateType})${breakingTag}`);
    }

    io.write("");

    const rawAnswer = await io.ask("Apply updates? [a]ll / [s]afe / [n]one / numbers: ");
    const answer = rawAnswer.toLowerCase();

    if (answer === "a" || answer === "all") {
        io.close();

        return updates;
    }

    if (answer === "s" || answer === "safe") {
        io.close();

        return updates.filter((update) => !isBreakingUpdate(update));
    }

    if (answer === "n" || answer === "none" || answer === "") {
        io.close();

        return [];
    }

    if (/^[\d ,]+$/.test(answer)) {
        const indices = parseIndexSelection(answer, updates.length);

        io.close();

        return indices.map((index) => updates[index]).filter((entry): entry is EcosystemUpdate => entry !== undefined);
    }

    io.close();

    return [];
};
