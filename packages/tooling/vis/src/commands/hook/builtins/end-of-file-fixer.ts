import { readFileSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";

import type { BuiltinContext } from "./types";

/**
 * Mirrors `pre-commit/pre-commit-hooks/end_of_file_fixer.py`: collapse
 * trailing `\n` / `\r\n` / `\r` runs to a single newline; add a newline
 * if missing; leave empty files alone.
 */
const runEndOfFileFixer = (files: ReadonlyArray<string>, _args: ReadonlyArray<string>, context: BuiltinContext): number => {
    let rc = 0;

    for (const file of files) {
        const absolutePath = join(context.root, file);
        const buf = readFileSync(absolutePath);

        if (buf.length === 0) {
            continue;
        }

        let end = buf.length;
        const last = buf[end - 1];

        if (last !== 0x0a && last !== 0x0d) {
            writeFileSync(absolutePath, Buffer.concat([buf, Buffer.from([0x0a])]));
            context.logger.info(`Fixing ${file}`);
            rc = 1;
            continue;
        }

        while (end > 0 && (buf[end - 1] === 0x0a || buf[end - 1] === 0x0d)) {
            end -= 1;
        }

        if (end === 0) {
            writeFileSync(absolutePath, Buffer.alloc(0));
            context.logger.info(`Fixing ${file}`);
            rc = 1;
            continue;
        }

        const trailing = buf.subarray(end);
        let keep: Buffer;

        if (trailing[0] === 0x0d && trailing[1] === 0x0a) {
            keep = Buffer.from([0x0d, 0x0a]);
        } else if (trailing[0] === 0x0d) {
            keep = Buffer.from([0x0d]);
        } else {
            keep = Buffer.from([0x0a]);
        }

        if (trailing.equals(keep)) {
            continue;
        }

        writeFileSync(absolutePath, Buffer.concat([buf.subarray(0, end), keep]));
        context.logger.info(`Fixing ${file}`);
        rc = 1;
    }

    return rc;
};

export { runEndOfFileFixer };
