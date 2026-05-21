import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

import term from "../helpers/ink-term";
import waitFor from "../helpers/wait-for";

const ptyRequire = createRequire(import.meta.url);
const ptyAvailable = (() => {
    try {
        ptyRequire("node-pty");

        return true;
    } catch {
        return false;
    }
})();

describe("hooks-use-input", () => {
    it.skipIf(!ptyAvailable)(
        "useInput - discrete priority keeps states in sync with useTransition during rapid input",
        async () => {
            expect.assertions(1);

            const ps = term("use-input-discrete-priority");
            const sleep = (ms: number) =>
                new Promise<void>((resolve) => {
                    setTimeout(resolve, ms);
                });

            // Wait for the app to be ready (ink-term waits for __READY__ internally)
            await waitFor(() => ps.output.includes("__READY__"), 10_000);

            // Send 5 delete keys with enough delay between them for React concurrent
            // scheduler to process each update. The fixture has a 30ms blocking useMemo
            // per deferred update, so we need generous delays for CI — 600ms gives React
            // headroom to retire each transition before the next keypress arrives.
            for (let index = 0; index < 5; index++) {
                ps.write("\u001B[3~");
                await sleep(600);
            }

            // Wait for both query and deferredQuery to be empty (fixture signals __SYNCED__).
            // The bump to 20s covers observed CI runs where the concurrent scheduler
            // takes longer than 10s to drain queued transitions under load.
            await waitFor(() => ps.output.includes("__SYNCED__"), 20_000);

            ps.write("\r");
            await ps.waitForExit();

            expect(ps.output).toContain('FINAL query:"" deferred:""');
        },
        60_000,
    );

    it.skipIf(!ptyAvailable)("useInput - handle lowercase character", async () => {
        expect.assertions(1);

        const ps = term("use-input", ["lowercase"]);

        ps.write("q");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - handle uppercase character", async () => {
        expect.assertions(1);

        const ps = term("use-input", ["uppercase"]);

        ps.write("Q");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)(String.raw`useInput - \r should not count as an uppercase character`, async () => {
        expect.assertions(1);

        const ps = term("use-input", ["uppercase"]);

        ps.write("\r");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - pasted carriage return", async () => {
        expect.assertions(1);

        const ps = term("use-input", ["pastedCarriageReturn"]);

        ps.write("\rtest");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - pasted tab", async () => {
        expect.assertions(1);

        const ps = term("use-input", ["pastedTab"]);

        ps.write("\ttest");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - receives bracketed paste with deprecation warning when no usePaste handler is active", async () => {
        expect.assertions(2);

        const ps = term("use-input", ["bracketedPaste"]);

        ps.write("\u001B[200~hello\u001B[201~");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
        expect(ps.output).toContain("Warning: useInput() received bracketed paste because no usePaste() handler is active.");
    });

    it.skipIf(!ptyAvailable)("useInput - handle escape", async () => {
        expect.assertions(1);

        const ps = term("use-input", ["escape"]);

        ps.write("\u001B");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - handle ctrl", async () => {
        expect.assertions(1);

        const ps = term("use-input", ["ctrl"]);

        ps.write("\u0006");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - handle meta", async () => {
        expect.assertions(1);

        const ps = term("use-input", ["meta"]);

        ps.write("\u001Bm");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - flushes ESC[ prefix as literal input", async () => {
        expect.assertions(1);

        const ps = term("use-input", ["escapeBracketPrefix"]);

        ps.write("\u001B[");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - handle meta + O with pending flush", async () => {
        expect.assertions(1);

        const ps = term("use-input", ["metaUpperO"]);

        ps.write("\u001BO");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - handle tab", async () => {
        expect.assertions(1);

        const ps = term("use-input", ["tab"]);

        ps.write("\t");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - handle shift + tab", async () => {
        expect.assertions(1);

        const ps = term("use-input", ["shiftTab"]);

        ps.write("\u001B[Z");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - handle backspace", async () => {
        expect.assertions(1);

        const ps = term("use-input", ["backspace"]);

        ps.write("\u0008");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - handle backspace (0x7F)", async () => {
        expect.assertions(1);

        const ps = term("use-input", ["backspace"]);

        ps.write("\u007F");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - handle remove (delete)", async () => {
        expect.assertions(1);

        const ps = term("use-input", ["remove"]);

        ps.write("\u001B[3~");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - handle option + return (macOS)", async () => {
        expect.assertions(1);

        const ps = term("use-input", ["returnMeta"]);

        ps.write("\u001B\r");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });
});
