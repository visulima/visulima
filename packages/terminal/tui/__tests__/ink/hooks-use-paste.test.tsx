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

it.skipIf(!ptyAvailable)("usePaste - receives bracketed paste as single text blob", async () => {
    const ps = term("use-paste", ["basic"]);
    ps.write("\u001B[200~hello world\u001B[201~");
    await ps.waitForExit();
    expect(ps.output.includes("exited")).toBe(true);
    expect(ps.output.includes("\u001B[?2004h")).toBe(true);
    expect(ps.output.includes("\u001B[?2004l")).toBe(true);
});

it.skipIf(!ptyAvailable)("usePaste - paste content with escape sequences is delivered verbatim", async () => {
    const ps = term("use-paste", ["escapeSequences"]);
    ps.write("\u001B[200~hello\u001B[Aworld\u001B[201~");
    await ps.waitForExit();
    expect(ps.output.includes("exited")).toBe(true);
});

it.skipIf(!ptyAvailable)("usePaste - useInput does not receive bracketed paste content", async () => {
    const ps = term("use-paste", ["noUseInput"]);
    ps.write("\u001B[200~hello\u001B[201~");
    await ps.waitForExit();
    expect(ps.output.includes("exited")).toBe(true);
});

it.skipIf(!ptyAvailable)("usePaste - multiple simultaneous hooks both receive the same paste event", async () => {
    const ps = term("use-paste", ["multipleHooks"]);
    ps.write("\u001B[200~hello\u001B[201~");
    await ps.waitForExit();
    expect(ps.output.includes("exited")).toBe(true);
});
