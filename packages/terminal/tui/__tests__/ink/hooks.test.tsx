import { strip as stripAnsi } from "@visulima/ansi";
import { describe, expect, it } from "vitest";

import { ptyAvailable } from "../helpers/ink-run";
import term from "../helpers/ink-term";

describe("hooks", () => {
    it.skipIf(!ptyAvailable)("useInput - ignore input if not active", async () => {
        expect.assertions(3);

        const ps = term("use-input-multiple");

        ps.write("x");
        await ps.waitForExit();

        expect(ps.output).not.toContain("xx");
        expect(ps.output).toContain("x");
        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - handle Ctrl+C when `exitOnCtrlC` is `false`", async () => {
        expect.assertions(1);

        const ps = term("use-input-ctrl-c");

        ps.write("\u0003");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - no MaxListenersExceededWarning with many useInput hooks", async () => {
        expect.assertions(2);

        const ps = term("use-input-many");

        await ps.waitForExit();

        expect(ps.output).not.toContain("MaxListenersExceededWarning");
        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - handle Ctrl+C via kitty codepoint-3 form when `exitOnCtrlC` is `false`", async () => {
        expect.assertions(1);

        const ps = term("use-input-ctrl-c");

        // Ctrl+C via kitty codepoint 3 form (modifier 5 = ctrl(4) + 1)
        ps.write("\u001B[3;5u");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useStdout - write to stdout", async () => {
        expect.assertions(1);

        const ps = term("use-stdout");

        await ps.waitForExit();

        const lines = stripAnsi(ps.output).split("\r\n");

        expect(lines.slice(1, -1)).toStrictEqual(["Hello from Ink to stdout", "Hello World", "exited"]);
    });
});
