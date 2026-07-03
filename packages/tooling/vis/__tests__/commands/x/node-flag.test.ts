/**
 * Tests for the `vis x --node` escape hatch: `--node` is parsed only before the
 * file (consistent with `--runtime`), and when set the target runs on plain Node
 * with ZERO vis augmentation — no TS load hook (so a `.ts`-only construct is NOT
 * transpiled) and no vis env vars injected into the child.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { parseLeanXArgs } from "../../../src/commands/x/lean";
import { runFile } from "../../../src/commands/x/run-file";

describe("parseLeanXArgs --node", () => {
    it("sets node=false by default", () => {
        expect.hasAssertions();

        expect(parseLeanXArgs(["script.js"])).toStrictEqual({
            file: "script.js",
            node: false,
            runtimeFlag: undefined,
            scriptArguments: [],
        });
    });

    it("recognises --node before the file", () => {
        expect.hasAssertions();

        expect(parseLeanXArgs(["--node", "script.js", "a"])).toStrictEqual({
            file: "script.js",
            node: true,
            runtimeFlag: undefined,
            scriptArguments: ["a"],
        });
    });

    it("combines --node with --runtime before the file", () => {
        expect.hasAssertions();

        expect(parseLeanXArgs(["--runtime", "node", "--node", "script.js"])).toStrictEqual({
            file: "script.js",
            node: true,
            runtimeFlag: "node",
            scriptArguments: [],
        });
    });

    it("does NOT recognise --node after the file (forwards it to the script)", () => {
        expect.hasAssertions();

        expect(parseLeanXArgs(["script.js", "--node"])).toStrictEqual({
            file: "script.js",
            node: false,
            runtimeFlag: undefined,
            scriptArguments: ["--node"],
        });
    });
});

describe("runFile { node: true }", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "vis-x-node-"));
    });

    afterEach(() => {
        rmSync(tmpDir, { force: true, recursive: true });
    });

    it("runs a plain .js file and forwards args, with NO vis env vars injected", async () => {
        expect.assertions(2);

        // The script writes its argv + a probe of every VIS_* env var it can see.
        const out = join(tmpDir, "out.json");
        const script = join(tmpDir, "probe.js");

        writeFileSync(
            script,
            [
                "const fs = require('node:fs');",
                "const visEnv = Object.keys(process.env).filter((k) => k.startsWith('VIS_'));",
                `fs.writeFileSync(${JSON.stringify(out)}, JSON.stringify({ args: process.argv.slice(2), visEnv }));`,
            ].join("\n"),
        );

        const code = await runFile(script, ["alpha", "beta"], "node", tmpDir, { node: true });

        expect(code).toBe(0);

        const { readFileSync } = await import("node:fs");
        const result = JSON.parse(readFileSync(out, "utf8")) as { args: string[]; visEnv: string[] };

        expect(result).toStrictEqual({ args: ["alpha", "beta"], visEnv: [] });
    });

    it("does NOT transpile a .ts file under --node (TS-only syntax is a runtime error)", async () => {
        expect.assertions(1);

        // `enum` is TS-only; plain Node cannot parse it, so a non-zero exit proves
        // the vis TS load hook was NOT applied.
        const script = join(tmpDir, "ts-only.ts");

        writeFileSync(script, "enum Color { Red, Green }\nconsole.log(Color.Red);\n");

        const code = await runFile(script, [], "node", tmpDir, { node: true });

        expect(code).not.toBe(0);
    });
});
