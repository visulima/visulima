import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { execVis, execVisJson } from "../src/exec";

const FAKE_VIS = fileURLToPath(new URL("__fixtures__/fake-vis.mjs", import.meta.url));

describe(execVis, () => {
    it("should capture stdout and exit code on success", async () => {
        expect.assertions(3);

        const result = await execVis(FAKE_VIS, ["list", "--json"]);

        expect(result.exitCode).toBe(0);
        expect(result.timedOut).toBe(false);
        expect(JSON.parse(result.stdout)).toHaveLength(2);
    });

    it("should preserve non-zero exit codes", async () => {
        expect.assertions(2);

        const result = await execVis(FAKE_VIS, ["fail-exit-code"]);

        expect(result.exitCode).toBe(7);
        expect(result.stderr).toContain("boom");
    });

    it("should mark timedOut when the subprocess exceeds timeoutMs", async () => {
        expect.assertions(1);

        // The fake binary exits immediately, so to test timeout we point at
        // the real node interpreter with an inline keep-alive script.
        const result = await execVis(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { timeoutMs: 100 });

        expect(result.timedOut).toBe(true);
    });

    it("should reject with the spawn error when cwd points at a non-existent directory", async () => {
        expect.assertions(1);

        // Node's `spawn` emits an 'error' event (not a non-zero exit) when
        // the requested cwd doesn't exist. This is the only way to trigger
        // the error branch in execVis without mocking child_process.
        await expect(execVis(FAKE_VIS, ["list", "--json"], { cwd: "/this/path/definitely/does/not/exist/ever" })).rejects.toThrow(/ENOENT|no such file/);
    });

    it("should flag overflowed and kill the child when output exceeds maxBufferBytes", async () => {
        expect.assertions(2);

        // fake-vis "flood-stdout" streams 200k chars then idles, so the kill
        // (not a natural exit) is what ends the process.
        const result = await execVis(FAKE_VIS, ["flood-stdout"], { maxBufferBytes: 1024, timeoutMs: 5000 });

        expect(result.overflowed).toBe(true);
        expect(result.timedOut).toBe(false);
    });
});

describe(execVisJson, () => {
    it("should parse stdout as JSON on success", async () => {
        expect.assertions(1);

        const result = await execVisJson<unknown[]>(FAKE_VIS, ["list", "--json"]);

        expect(result).toHaveLength(2);
    });

    it("should throw on non-zero exit", async () => {
        expect.assertions(1);

        await expect(execVisJson(FAKE_VIS, ["fail-exit-code"])).rejects.toThrow(/exited with code 7/);
    });

    it("should omit the stderr tail when the failing process writes nothing to stderr", async () => {
        expect.assertions(2);

        // The fake binary exits non-zero with empty stderr — the error
        // message should report the code without a trailing stderr section.
        const promise = execVisJson(FAKE_VIS, ["fail-empty-stderr"]);

        await expect(promise).rejects.toThrow(/exited with code 5/);
        await expect(promise).rejects.toThrow(/exited with code 5$/);
    });

    it("should throw on invalid JSON", async () => {
        expect.assertions(1);

        await expect(execVisJson(FAKE_VIS, ["fail-bad-json"])).rejects.toThrow(/did not emit valid JSON/);
    });

    it("should throw a timeout error when the subprocess exceeds timeoutMs", async () => {
        expect.assertions(1);

        await expect(execVisJson(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { timeoutMs: 100 })).rejects.toThrow(/timed out after 100ms/);
    });

    it("should throw an output-limit error when the subprocess exceeds maxBufferBytes", async () => {
        expect.assertions(1);

        await expect(execVisJson(FAKE_VIS, ["flood-stdout"], { maxBufferBytes: 1024, timeoutMs: 5000 })).rejects.toThrow(/exceeded the 1024-byte output limit/);
    });
});
