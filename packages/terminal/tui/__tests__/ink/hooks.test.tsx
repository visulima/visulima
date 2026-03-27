import { createRequire } from "node:module";

import { strip as stripAnsi } from "@visulima/ansi";
import { expect, it } from "vitest";

import term from "../helpers/ink-term.js";

const _request = createRequire(import.meta.url);
const ptyAvailable = (() => {
    try {
        _request("node-pty");

        return true;
    } catch {
        return false;
    }
})();

it.skipIf(!ptyAvailable)("useInput - ignore input if not active", async () => {
    const ps = term("use-input-multiple");

    ps.write("x");
    await ps.waitForExit();

    expect(ps.output).not.toContain("xx");
    expect(ps.output).toContain("x");
    expect(ps.output).toContain("exited");
});

it.skipIf(!ptyAvailable)("useInput - handle Ctrl+C when `exitOnCtrlC` is `false`", async () => {
    const ps = term("use-input-ctrl-c");

    ps.write("\u0003");
    await ps.waitForExit();

    expect(ps.output).toContain("exited");
});

it.skipIf(!ptyAvailable)("useInput - no MaxListenersExceededWarning with many useInput hooks", async () => {
    const ps = term("use-input-many");

    await ps.waitForExit();

    expect(ps.output).not.toContain("MaxListenersExceededWarning");
    expect(ps.output).toContain("exited");
});

it.skipIf(!ptyAvailable)("useInput - handle Ctrl+C via kitty codepoint-3 form when `exitOnCtrlC` is `false`", async () => {
    const ps = term("use-input-ctrl-c");

    // Ctrl+C via kitty codepoint 3 form (modifier 5 = ctrl(4) + 1)
    ps.write("\u001B[3;5u");
    await ps.waitForExit();

    expect(ps.output).toContain("exited");
});

it.skipIf(!ptyAvailable)("useStdout - write to stdout", async () => {
    const ps = term("use-stdout");

    await ps.waitForExit();

    const lines = stripAnsi(ps.output).split("\r\n");

    expect(lines.slice(1, -1)).toEqual(["Hello from Ink to stdout", "Hello World", "exited"]);
});
