import { describe, expect, it } from "vitest";

import { ptyAvailable } from "../helpers/ink-run";
import term from "../helpers/ink-term";

describe("hooks-use-paste", () => {
    it.skipIf(!ptyAvailable)("usePaste - receives bracketed paste as single text blob", async () => {
        expect.assertions(3);

        const ps = term("use-paste", ["basic"]);

        ps.write("\u001B[200~hello world\u001B[201~");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
        expect(ps.output).toContain("\u001B[?2004h");
        expect(ps.output).toContain("\u001B[?2004l");
    });

    it.skipIf(!ptyAvailable)("usePaste - paste content with escape sequences is delivered verbatim", async () => {
        expect.assertions(1);

        const ps = term("use-paste", ["escapeSequences"]);

        ps.write("\u001B[200~hello\u001B[Aworld\u001B[201~");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("usePaste - useInput does not receive bracketed paste content", async () => {
        expect.assertions(1);

        const ps = term("use-paste", ["noUseInput"]);

        ps.write("\u001B[200~hello\u001B[201~");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("usePaste - multiple simultaneous hooks both receive the same paste event", async () => {
        expect.assertions(1);

        const ps = term("use-paste", ["multipleHooks"]);

        ps.write("\u001B[200~hello\u001B[201~");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });
});
