import { describe, expect, it } from "vitest";
import term from "../helpers/ink-term.js";

import { createRequire } from "node:module";
const _req = createRequire(import.meta.url);
const ptyAvailable = (() => {
    try {
        _req("node-pty");
        return true;
    } catch {
        return false;
    }
})();

it.skipIf(!ptyAvailable)("useInput - discrete priority keeps states in sync with useTransition during rapid input", async () => {
    const ps = term("use-input-discrete-priority");
    const delay = async (ms: number) =>
        new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    const pressDeleteKey = () => {
        ps.write("\u001B[3~");
    };

    for (const delayMilliseconds of [0, 30, 60, 90, 120]) {
        setTimeout(() => {
            pressDeleteKey();
        }, delayMilliseconds);
    }

    await delay(200);
    await delay(2000);
    ps.write("\r");
    await ps.waitForExit();
    expect(ps.output.includes('FINAL query:"" deferred:""')).toBe(true);
});

it.skipIf(!ptyAvailable)("useInput - handle lowercase character", async () => {
    const ps = term("use-input", ["lowercase"]);
    ps.write("q");
    await ps.waitForExit();
    expect(ps.output.includes("exited")).toBe(true);
});

it.skipIf(!ptyAvailable)("useInput - handle uppercase character", async () => {
    const ps = term("use-input", ["uppercase"]);
    ps.write("Q");
    await ps.waitForExit();
    expect(ps.output.includes("exited")).toBe(true);
});

it.skipIf(!ptyAvailable)("useInput - \\r should not count as an uppercase character", async () => {
    const ps = term("use-input", ["uppercase"]);
    ps.write("\r");
    await ps.waitForExit();
    expect(ps.output.includes("exited")).toBe(true);
});

it.skipIf(!ptyAvailable)("useInput - pasted carriage return", async () => {
    const ps = term("use-input", ["pastedCarriageReturn"]);
    ps.write("\rtest");
    await ps.waitForExit();
    expect(ps.output.includes("exited")).toBe(true);
});

it.skipIf(!ptyAvailable)("useInput - pasted tab", async () => {
    const ps = term("use-input", ["pastedTab"]);
    ps.write("\ttest");
    await ps.waitForExit();
    expect(ps.output.includes("exited")).toBe(true);
});

it.skipIf(!ptyAvailable)("useInput - receives bracketed paste when no usePaste handler is active", async () => {
    const ps = term("use-input", ["bracketedPaste"]);
    ps.write("\u001B[200~hello\u001B[201~");
    await ps.waitForExit();
    expect(ps.output.includes("exited")).toBe(true);
});

it.skipIf(!ptyAvailable)("useInput - handle escape", async () => {
    const ps = term("use-input", ["escape"]);
    ps.write("\u001B");
    await ps.waitForExit();
    expect(ps.output.includes("exited")).toBe(true);
});

it.skipIf(!ptyAvailable)("useInput - handle ctrl", async () => {
    const ps = term("use-input", ["ctrl"]);
    ps.write("\u0006");
    await ps.waitForExit();
    expect(ps.output.includes("exited")).toBe(true);
});

it.skipIf(!ptyAvailable)("useInput - handle meta", async () => {
    const ps = term("use-input", ["meta"]);
    ps.write("\u001Bm");
    await ps.waitForExit();
    expect(ps.output.includes("exited")).toBe(true);
});

it.skipIf(!ptyAvailable)("useInput - flushes ESC[ prefix as literal input", async () => {
    const ps = term("use-input", ["escapeBracketPrefix"]);
    ps.write("\u001B[");
    await ps.waitForExit();
    expect(ps.output.includes("exited")).toBe(true);
});

it.skipIf(!ptyAvailable)("useInput - handle meta + O with pending flush", async () => {
    const ps = term("use-input", ["metaUpperO"]);
    ps.write("\u001BO");
    await ps.waitForExit();
    expect(ps.output.includes("exited")).toBe(true);
});

it.skipIf(!ptyAvailable)("useInput - handle tab", async () => {
    const ps = term("use-input", ["tab"]);
    ps.write("\t");
    await ps.waitForExit();
    expect(ps.output.includes("exited")).toBe(true);
});

it.skipIf(!ptyAvailable)("useInput - handle shift + tab", async () => {
    const ps = term("use-input", ["shiftTab"]);
    ps.write("\u001B[Z");
    await ps.waitForExit();
    expect(ps.output.includes("exited")).toBe(true);
});

it.skipIf(!ptyAvailable)("useInput - handle backspace", async () => {
    const ps = term("use-input", ["backspace"]);
    ps.write("\u0008");
    await ps.waitForExit();
    expect(ps.output.includes("exited")).toBe(true);
});

it.skipIf(!ptyAvailable)("useInput - handle delete", async () => {
    const ps = term("use-input", ["delete"]);
    ps.write("\u007F");
    await ps.waitForExit();
    expect(ps.output.includes("exited")).toBe(true);
});

it.skipIf(!ptyAvailable)("useInput - handle remove (delete)", async () => {
    const ps = term("use-input", ["remove"]);
    ps.write("\u001B[3~");
    await ps.waitForExit();
    expect(ps.output.includes("exited")).toBe(true);
});

it.skipIf(!ptyAvailable)("useInput - handle option + return (macOS)", async () => {
    const ps = term("use-input", ["returnMeta"]);
    ps.write("\u001B\r");
    await ps.waitForExit();
    expect(ps.output.includes("exited")).toBe(true);
});
