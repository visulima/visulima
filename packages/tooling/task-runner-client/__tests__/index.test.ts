import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { disableCache, getEnv, getEnvs, ignoreInput, ignoreOutput } from "../src";

const HINTS_ENV = "TASK_RUNNER_HINTS";

describe("task-runner-client", () => {
    let directory: string;
    let hintsFile: string;

    const readLines = (): Record<string, unknown>[] =>
        readFileSync(hintsFile, "utf8")
            .split("\n")
            .filter(Boolean)
            .map((line) => JSON.parse(line) as Record<string, unknown>);

    beforeEach(() => {
        directory = mkdtempSync(join(tmpdir(), "trc-"));
        hintsFile = join(directory, "hints.ndjson");
    });

    afterEach(() => {
        delete process.env[HINTS_ENV];
        rmSync(directory, { force: true, recursive: true });
    });

    describe("outside a runner (no TASK_RUNNER_HINTS)", () => {
        it("is a no-op for every emitting call", () => {
            expect.assertions(1);

            // No hints file should be written when the env var is unset.
            expect(() => {
                ignoreInput("/x");
                ignoreOutput("/y");
                disableCache();
                getEnv("PATH");
                getEnvs("PATH*");
            }).not.toThrow();
        });

        it("getEnv still returns the value", () => {
            expect.assertions(1);

            process.env["TRC_FIXTURE"] = "hello";

            expect(getEnv("TRC_FIXTURE")).toBe("hello");

            delete process.env["TRC_FIXTURE"];
        });
    });

    describe("inside a runner (TASK_RUNNER_HINTS set)", () => {
        beforeEach(() => {
            process.env[HINTS_ENV] = hintsFile;
        });

        it("appends one NDJSON line per path hint", () => {
            expect.assertions(1);

            ignoreInput("./node_modules/.cache/eslint");
            ignoreOutput("./tmp/scratch");

            expect(readLines()).toStrictEqual([
                { op: "ignoreInput", path: "./node_modules/.cache/eslint" },
                { op: "ignoreOutput", path: "./tmp/scratch" },
            ]);
        });

        it("emits disableCache", () => {
            expect.assertions(1);

            disableCache();

            expect(readLines()).toStrictEqual([{ op: "disableCache" }]);
        });

        it("getEnv returns the value AND registers a trackEnv hint by default", () => {
            expect.assertions(2);

            process.env["TRC_API"] = "v2";

            expect(getEnv("TRC_API")).toBe("v2");
            expect(readLines()).toStrictEqual([{ name: "TRC_API", op: "trackEnv" }]);

            delete process.env["TRC_API"];
        });

        it("getEnv with tracked:false does not register a hint", () => {
            expect.assertions(2);

            process.env["TRC_API"] = "v2";

            expect(getEnv("TRC_API", { tracked: false })).toBe("v2");
            expect(() => readFileSync(hintsFile, "utf8")).toThrow();

            delete process.env["TRC_API"];
        });

        it("getEnvs returns matching vars and registers a trackEnvPattern hint", () => {
            expect.assertions(2);

            process.env["VITE_A"] = "1";
            process.env["VITE_B"] = "2";
            process.env["OTHER"] = "3";

            expect(getEnvs("VITE_*")).toStrictEqual({ VITE_A: "1", VITE_B: "2" });
            expect(readLines()).toStrictEqual([{ op: "trackEnvPattern", pattern: "VITE_*" }]);

            delete process.env["VITE_A"];
            delete process.env["VITE_B"];
            delete process.env["OTHER"];
        });
    });
});
