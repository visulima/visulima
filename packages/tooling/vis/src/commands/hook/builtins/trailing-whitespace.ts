import { readFileSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";

import type { BuiltinContext } from "./types";

// TAB, VT, FF, CR, SP
const WHITESPACE = new Set<number>([0x09, 0x0b, 0x0c, 0x0d, 0x20]);
const MARKDOWN_RE = /\.(?:md|markdown|mdown|mdx)$/i;

/**
 * Mirrors `pre-commit/pre-commit-hooks/trailing_whitespace_fixer.py`:
 * strip trailing whitespace from each line, preserve original endings,
 * preserve markdown hard-break trailing two-spaces on non-blank lines.
 */
const runTrailingWhitespace = (files: ReadonlyArray<string>, _args: ReadonlyArray<string>, context: BuiltinContext): number => {
    let rc = 0;

    for (const file of files) {
        const isMarkdown = MARKDOWN_RE.test(file);
        const absolutePath = join(context.root, file);
        const buf = readFileSync(absolutePath);
        const out: Buffer[] = [];
        let i = 0;

        while (i <= buf.length) {
            let end = i;

            while (end < buf.length && buf[end] !== 0x0a) {
                end += 1;
            }

            const hadLf = end < buf.length && buf[end] === 0x0a;
            let contentEnd = end;
            let hadCr = false;

            if (hadLf && end > i && buf[end - 1] === 0x0d) {
                hadCr = true;
                contentEnd = end - 1;
            }

            const content = buf.subarray(i, contentEnd);
            let stripEnd = content.length;

            while (stripEnd > 0 && WHITESPACE.has(content[stripEnd - 1]!)) {
                stripEnd -= 1;
            }

            const nonWhitespace = content.some((b) => !WHITESPACE.has(b));

            if (isMarkdown && content.length >= 2 && content[content.length - 1] === 0x20 && content[content.length - 2] === 0x20 && nonWhitespace) {
                stripEnd = Math.min(stripEnd + 2, content.length);
            }

            out.push(content.subarray(0, stripEnd));

            if (hadCr) {
                out.push(Buffer.from([0x0d]));
            }

            if (hadLf) {
                out.push(Buffer.from([0x0a]));
            }

            if (!hadLf) {
                break;
            }

            i = end + 1;
        }

        const next = Buffer.concat(out);

        if (!next.equals(buf)) {
            writeFileSync(absolutePath, next);
            context.logger.info(`Fixing ${file}`);
            rc = 1;
        }
    }

    return rc;
};

export { runTrailingWhitespace };
