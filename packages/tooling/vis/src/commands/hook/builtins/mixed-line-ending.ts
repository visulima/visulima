import { readFileSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";

import type { BuiltinContext } from "./types";

const ENDINGS: Record<string, Buffer> = {
    cr: Buffer.from([0x0d]),
    crlf: Buffer.from([0x0d, 0x0a]),
    lf: Buffer.from([0x0a]),
};

const FIX_VALUES = new Set<string>(["auto", "cr", "crlf", "lf", "no"]);

type LineEnding = "cr" | "crlf" | "lf";

interface Line {
    content: Buffer;
    ending: LineEnding | null;
}

/**
 * Mirrors `pre-commit/pre-commit-hooks/mixed_line_ending.py`.
 *
 * Recognised `args`:
 *   `--fix=&lt;value>` or `-f &lt;value>` / `--fix &lt;value>`
 *     where value is one of `auto` (default), `no`, `lf`, `crlf`, `cr`.
 */
const runMixedLineEnding = (files: ReadonlyArray<string>, args: ReadonlyArray<string>, context: BuiltinContext): number => {
    let fixArg = "auto";

    for (let idx = 0; idx < args.length; idx += 1) {
        const a = args[idx]!;

        if (a === "-f" || a === "--fix") {
            idx += 1;
            const next = args[idx];

            if (next === undefined) {
                context.logger.error(`mixed-line-ending: ${a} requires a value (auto|no|lf|crlf|cr)`);

                return 2;
            }

            fixArg = next;
        } else if (a.startsWith("--fix=")) {
            fixArg = a.slice("--fix=".length);
        }
    }

    if (!FIX_VALUES.has(fixArg)) {
        context.logger.error(`mixed-line-ending: invalid --fix value ${fixArg}`);

        return 2;
    }

    let rc = 0;

    for (const file of files) {
        const absolutePath = join(context.root, file);
        const buf = readFileSync(absolutePath);
        // Tracks insertion order so the auto-fix target on a tie matches
        // the upstream `Counter.most_common(1)`: first-seen wins, not
        // last-iterated.
        const counts: { count: number; kind: LineEnding }[] = [];
        const bumpCount = (kind: LineEnding): void => {
            const existing = counts.find((c) => c.kind === kind);

            if (existing) {
                existing.count += 1;
            } else {
                counts.push({ count: 1, kind });
            }
        };
        const lines: Line[] = [];
        let start = 0;

        for (let i = 0; i < buf.length; i += 1) {
            const b = buf[i];

            if (b === 0x0d && buf[i + 1] === 0x0a) {
                lines.push({ content: buf.subarray(start, i), ending: "crlf" });
                bumpCount("crlf");
                i += 1;
                start = i + 1;
            } else if (b === 0x0d) {
                lines.push({ content: buf.subarray(start, i), ending: "cr" });
                bumpCount("cr");
                start = i + 1;
            } else if (b === 0x0a) {
                lines.push({ content: buf.subarray(start, i), ending: "lf" });
                bumpCount("lf");
                start = i + 1;
            }
        }

        if (start < buf.length) {
            lines.push({ content: buf.subarray(start), ending: null });
        }

        const mixed = counts.length > 1;

        if (fixArg === "no") {
            if (mixed) {
                context.logger.info(`${file}: mixed line endings`);
                rc = 1;
            }

            continue;
        }

        let target: "cr" | "crlf" | "lf" | undefined;

        if (fixArg === "auto") {
            if (!mixed) {
                continue;
            }

            // First-seen wins on ties (matches `Counter.most_common`).
            let best: { count: number; kind: "cr" | "crlf" | "lf" } | undefined;

            for (const c of counts) {
                if (!best || c.count > best.count) {
                    best = c;
                }
            }

            target = best?.kind;
        } else {
            target = fixArg as "cr" | "crlf" | "lf";
            const other = counts.some((c) => c.kind !== target && c.count > 0);

            if (!other) {
                continue;
            }
        }

        const ending = ENDINGS[target!]!;
        const chunks: Buffer[] = [];

        for (const line of lines) {
            chunks.push(line.content);

            if (line.ending !== null) {
                chunks.push(ending);
            }
        }

        writeFileSync(absolutePath, Buffer.concat(chunks));
        context.logger.info(`${file}: fixed mixed line endings`);
        rc = 1;
    }

    return rc;
};

export { runMixedLineEnding };
