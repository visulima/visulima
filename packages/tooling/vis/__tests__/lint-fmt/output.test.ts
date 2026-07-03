import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveOutput, writeOutput } from "../../src/lint-fmt/output";

let workspaceRoot: string;

describe(resolveOutput, () => {
    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-output-"));
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    it("wraps process.stdout when target is undefined", () => {
        expect.assertions(2);

        const sink = resolveOutput({ cwd: workspaceRoot, target: undefined });

        expect(sink).toHaveProperty("write");
        expect(sink).toHaveProperty("close");
    });

    it("wraps process.stdout for `-` and `stdout` aliases", () => {
        expect.assertions(2);

        const dashSink = resolveOutput({ cwd: workspaceRoot, target: "-" });
        const stdoutSink = resolveOutput({ cwd: workspaceRoot, target: "stdout" });

        expect(dashSink.close).toBeTypeOf("function");
        expect(stdoutSink.close).toBeTypeOf("function");
    });

    it("wraps process.stderr for the `stderr` alias", () => {
        expect.assertions(1);

        const sink = resolveOutput({ cwd: workspaceRoot, target: "stderr" });

        expect(sink).toHaveProperty("write");
    });

    it("writes to a file at an absolute path", () => {
        expect.assertions(1);

        const target = join(workspaceRoot, "report.txt");
        const sink = resolveOutput({ cwd: workspaceRoot, target });

        sink.write("hello ");
        sink.write("world\n");
        sink.close();

        expect(readFileSync(target, "utf8")).toBe("hello world\n");
    });

    it("resolves relative target against cwd", () => {
        expect.assertions(1);

        const sink = resolveOutput({ cwd: workspaceRoot, target: "report.json" });

        sink.write("{}\n");
        sink.close();

        expect(readFileSync(join(workspaceRoot, "report.json"), "utf8")).toBe("{}\n");
    });

    it("creates parent directories as needed", () => {
        expect.assertions(1);

        const target = join(workspaceRoot, "deep", "nested", "out.sarif");
        const sink = resolveOutput({ cwd: workspaceRoot, target });

        sink.write("sarif");
        sink.close();

        expect(readFileSync(target, "utf8")).toBe("sarif");
    });

    it("buffers writes and flushes on close", () => {
        expect.assertions(1);

        const target = join(workspaceRoot, "buffered.txt");
        const sink = resolveOutput({ cwd: workspaceRoot, target });

        for (let index = 0; index < 5; index += 1) {
            sink.write(`chunk-${String(index)}\n`);
        }

        sink.close();

        expect(readFileSync(target, "utf8")).toBe("chunk-0\nchunk-1\nchunk-2\nchunk-3\nchunk-4\n");
    });

    it("close is a no-op for stdout/stderr sinks", () => {
        expect.assertions(1);

        const sink = resolveOutput({ cwd: workspaceRoot, target: "stdout" });

        expect(() => {
            sink.close();
            sink.close();
        }).not.toThrow();
    });
});

describe(writeOutput, () => {
    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-output-"));
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    it("writes content to a file in one shot", () => {
        expect.assertions(1);

        const target = join(workspaceRoot, "one-shot.json");

        writeOutput({ content: "{\"ok\": true}\n", cwd: workspaceRoot, target });

        expect(readFileSync(target, "utf8")).toBe("{\"ok\": true}\n");
    });

    it("resolves relative path against cwd", () => {
        expect.assertions(1);

        writeOutput({ content: "hi\n", cwd: workspaceRoot, target: "nested/relative.txt" });

        expect(readFileSync(join(workspaceRoot, "nested", "relative.txt"), "utf8")).toBe("hi\n");
    });

    it("falls back to the sink for stdout/stderr/undefined targets", () => {
        expect.assertions(1);

        expect(() => {
            writeOutput({ content: "to stdout\n", cwd: workspaceRoot, target: undefined });
        }).not.toThrow();
    });
});
