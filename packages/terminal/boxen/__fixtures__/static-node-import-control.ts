/**
 * Control sample for `__tests__/workerd/module-graph.test.ts`.
 *
 * This module is never executed — it exists only so the module-graph guard has a
 * source file that *does* contain the declarations it is meant to catch. Without
 * it, the guard would report an empty list for every input and still pass.
 *
 * The dynamic `import()` below must NOT be reported: deferring a builtin behind a
 * dynamic import is exactly the pattern the guard is supposed to permit.
 *
 * The `node:fs` import is deliberately wrapped across several lines — the shape
 * Prettier produces once a named-import list runs past the print width. A
 * line-based scan would never see it, so it belongs here as a sample the guard
 * has to catch. This directory is both `.prettierignore`d and `eslint.config.js`
 * ignored, so the wrapping stays exactly as written.
 */

import { execFileSync } from "node:child_process";
import {
    readFileSync,
    writeFileSync,
} from "node:fs";

// eslint-disable-next-line import/no-extraneous-dependencies
import terminalSize from "terminal-size";

export const runProbe = async (): Promise<string> => {
    const { fileURLToPath } = await import("node:url");

    writeFileSync("/dev/null", readFileSync("/dev/null"));

    return `${fileURLToPath("file:///")}${execFileSync("true").toString()}${terminalSize().columns}`;
};
