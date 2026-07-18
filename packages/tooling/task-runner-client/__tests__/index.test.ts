import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    disableCache,
    getEnv,
    getEnvs,
    getProtocolVersion,
    HINTS_ENV,
    ignoreInput,
    ignoreOutput,
    isManaged,
    PROTOCOL_ENV,
    SUPPORTED_PROTOCOL_VERSION,
    trackInput,
    trackOutput,
    trackValue,
} from "../src";

describe("task-runner-client", () => {
    let directory: string;
    let hintsFile: string;

    const readLines = (): Record<string, unknown>[] =>
        readFileSync(hintsFile, "utf8")
            .split("\n")
            .filter(Boolean)
            .map((line) => JSON.parse(line) as Record<string, unknown>);

    beforeEach(() => {
        // realpathSync so the path matches process.cwd() after chdir — on
        // macOS tmpdir() is a /var -> /private/var symlink, and cwd resolves it.
        directory = realpathSync(mkdtempSync(join(tmpdir(), "trc-")));
        hintsFile = join(directory, "hints.ndjson");
    });

    afterEach(() => {
        delete process.env[HINTS_ENV];
        delete process.env[PROTOCOL_ENV];
        rmSync(directory, { force: true, recursive: true });
    });

    describe("constants and predicates", () => {
        it("exports the wire-contract env-var names", () => {
            expect.assertions(2);

            expect(HINTS_ENV).toBe("TASK_RUNNER_HINTS");
            expect(PROTOCOL_ENV).toBe("TASK_RUNNER_PROTOCOL");
        });

        it("isManaged reflects the presence of TASK_RUNNER_HINTS", () => {
            expect.assertions(2);

            expect(isManaged()).toBe(false);

            process.env[HINTS_ENV] = hintsFile;

            expect(isManaged()).toBe(true);
        });

        it("getProtocolVersion returns undefined outside a runner and the runner value inside", () => {
            expect.assertions(2);

            expect(getProtocolVersion()).toBeUndefined();

            process.env[PROTOCOL_ENV] = SUPPORTED_PROTOCOL_VERSION;

            expect(getProtocolVersion()).toBe("1");
        });
    });

    describe("outside a runner (no TASK_RUNNER_HINTS)", () => {
        it("is a no-op for every emitting call", () => {
            expect.assertions(1);

            // No hints file should be written when the env var is unset.
            expect(() => {
                ignoreInput("/x");
                ignoreOutput("/y");
                trackInput("/a");
                trackOutput("/b");
                trackValue("schema", "v3");
                disableCache("flaky");
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

        it("appends one NDJSON line per path hint and resolves paths to absolute", () => {
            expect.assertions(1);

            ignoreInput("./node_modules/.cache/eslint");
            ignoreOutput("./tmp/scratch");

            expect(readLines()).toStrictEqual([
                { op: "ignoreInput", path: resolve("./node_modules/.cache/eslint") },
                { op: "ignoreOutput", path: resolve("./tmp/scratch") },
            ]);
        });

        it("resolves ignore paths against the current cwd, not the runner's view", () => {
            expect.assertions(1);

            const previous = process.cwd();

            try {
                process.chdir(directory);
                ignoreInput("cache");

                expect(readLines()).toStrictEqual([{ op: "ignoreInput", path: resolve(directory, "cache") }]);
            } finally {
                process.chdir(previous);
            }
        });

        it("emits trackInput and trackOutput as positive hints with absolute paths", () => {
            expect.assertions(1);

            trackInput("./hidden-input");
            trackOutput("./hidden-output");

            expect(readLines()).toStrictEqual([
                { op: "trackInput", path: resolve("./hidden-input") },
                { op: "trackOutput", path: resolve("./hidden-output") },
            ]);
        });

        it("emits a custom cache-key value via trackValue", () => {
            expect.assertions(1);

            trackValue("db-schema", "rev-42");

            expect(readLines()).toStrictEqual([{ key: "db-schema", op: "trackValue", value: "rev-42" }]);
        });

        it("emits disableCache without a reason", () => {
            expect.assertions(1);

            disableCache();

            expect(readLines()).toStrictEqual([{ op: "disableCache" }]);
        });

        it("emits disableCache with a reason when provided", () => {
            expect.assertions(1);

            disableCache("network flake");

            expect(readLines()).toStrictEqual([{ op: "disableCache", reason: "network flake" }]);
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

        it("de-duplicates repeated identical hints within one task", () => {
            expect.assertions(2);

            process.env["CI"] = "true";

            // Simulate a per-file loop reading the same env var repeatedly.
            for (let index = 0; index < 5; index += 1) {
                getEnv("CI");
            }

            expect(readLines()).toStrictEqual([{ name: "CI", op: "trackEnv" }]);

            // A different payload still gets written.
            getEnv("HOME");

            expect(readLines()).toHaveLength(2);

            delete process.env["CI"];
        });

        describe("failed write is swallowed and retried", () => {
            it("never throws when the hints file can't be written and writes nothing", () => {
                expect.assertions(2);

                const nestedFile = join(directory, "missing", "hints.ndjson");

                process.env[HINTS_ENV] = nestedFile;

                // The parent directory doesn't exist, so appendFileSync throws
                // internally — the call must swallow it and leave no file.
                expect(() => getEnv("TRC_RETRY")).not.toThrow();
                expect(existsSync(nestedFile)).toBe(false);
            });

            it("retries the same hint on a later call after a transient failure", () => {
                expect.assertions(2);

                const nestedDirectory = join(directory, "missing");
                const nestedFile = join(nestedDirectory, "hints.ndjson");

                process.env[HINTS_ENV] = nestedFile;

                // First attempt fails (parent dir absent) and must NOT mark the
                // payload as emitted, so a retry can still land it.
                getEnv("TRC_RETRY");

                mkdirSync(nestedDirectory);

                getEnv("TRC_RETRY");

                const lines = readFileSync(nestedFile, "utf8")
                    .split("\n")
                    .filter(Boolean)
                    .map((line) => JSON.parse(line) as Record<string, unknown>);

                expect(lines).toStrictEqual([{ name: "TRC_RETRY", op: "trackEnv" }]);

                // The retry wrote exactly once — the failed attempt was not
                // double-counted after the directory appeared.
                expect(lines).toHaveLength(1);
            });
        });

        describe("env glob matching", () => {
            it("escapes regex metacharacters so a literal dot is not a wildcard", () => {
                expect.assertions(2);

                process.env["A.B_X"] = "match";
                process.env["AXB_X"] = "nope";

                // `A.B*` must match `A.B_X` literally, NOT `AXB_X`.
                expect(getEnvs("A.B*", { tracked: false })).toStrictEqual({ "A.B_X": "match" });
                expect(getEnvs("A.B*", { tracked: false })).not.toHaveProperty("AXB_X");

                delete process.env["A.B_X"];
                delete process.env["AXB_X"];
            });

            it("materializes a clean Object (no prototype pollution) for matched vars", () => {
                expect.assertions(2);

                process.env["TRC_CLEAN"] = "ok";

                const result = getEnvs("TRC_*", { tracked: false });

                // The returned value keeps a normal Object prototype (the Map +
                // Object.fromEntries materialization defends against reserved
                // names like `__proto__`/`constructor` triggering setters), and
                // the global Object prototype is never touched.
                expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
                expect(Object.prototype).not.toHaveProperty("TRC_CLEAN");

                delete process.env["TRC_CLEAN"];
            });

            it("neutralizes a reserved __proto__ key without polluting the prototype", () => {
                expect.assertions(3);

                // A `__proto__`-named env var must land as an own data property
                // (via the Map + Object.fromEntries materialization), never as a
                // setter invocation that rewrites the result's prototype.
                // The key is held in a variable so the literal never appears in
                // the source (eslint no-proto / no-restricted-properties).
                const reserved = "__proto__";

                process.env[reserved] = "polluted";

                const result = getEnvs(reserved, { tracked: false });

                expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
                expect(Object.hasOwn(result, reserved)).toBe(true);
                expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();

                delete process.env[reserved];
            });
        });
    });
});
