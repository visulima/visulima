import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from "vitest";

import { computeTaskHash, InProcessTaskHasher } from "../../src/task-hasher";
import type { FingerprintContributor, Task, TaskHashDetails } from "../../src/types";

const createTemporaryDirectory = async (): Promise<string> => {
    // eslint-disable-next-line sonarjs/pseudo-random
    const directory = join(tmpdir(), `hasher-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    await mkdir(directory, { recursive: true });

    return directory;
};

describe(InProcessTaskHasher, () => {
    let workspaceRoot: string;

    beforeEach(async () => {
        workspaceRoot = await createTemporaryDirectory();

        // Create test project structure
        await mkdir(join(workspaceRoot, "packages/lib-a/src"), { recursive: true });
        await writeFile(join(workspaceRoot, "packages/lib-a/src/index.ts"), "export const a = 1;");
        await writeFile(join(workspaceRoot, "packages/lib-a/package.json"), '{"name":"lib-a"}');
    });

    afterEach(async () => {
        await rm(workspaceRoot, { force: true, recursive: true });

        // Clean up env vars that tests may set
        delete process.env["TEST_VAR_HASHER"];
        delete process.env["NEXT_PUBLIC_API_URL"];
        delete process.env["NEXT_PUBLIC_TEST"];
    });

    it("should hash a task with default inputs (all project files)", async () => {
        expect.assertions(2);

        const hasher = new InProcessTaskHasher({
            projects: {
                "lib-a": { root: "packages/lib-a" },
            },
            workspaceRoot,
        });

        const task: Task = {
            id: "lib-a:build",
            outputs: [],
            overrides: {},
            target: { project: "lib-a", target: "build" },
        };

        const details = await hasher.hashTask(task);

        expect(details.command).toBeDefined();
        expect(Object.keys(details.nodes).length).toBeGreaterThan(0);
    });

    it("should produce different hashes for different file contents", async () => {
        expect.assertions(1);

        const hasher = new InProcessTaskHasher({
            projects: {
                "lib-a": { root: "packages/lib-a" },
            },
            workspaceRoot,
        });

        const task: Task = {
            id: "lib-a:build",
            outputs: [],
            overrides: {},
            target: { project: "lib-a", target: "build" },
        };

        const hash1 = await hasher.hashTask(task);

        // Modify a file
        await writeFile(join(workspaceRoot, "packages/lib-a/src/index.ts"), "export const a = 42;");

        // Clear cache and rehash
        hasher.clearCache();

        const hash2 = await hasher.hashTask(task);

        expect(hash1.nodes).not.toStrictEqual(hash2.nodes);
    });

    it("should emit a diagnostic when a cacheable task's file-set inputs resolve to zero files", async () => {
        expect.assertions(2);

        const diagnostics: { message: string; taskId: string }[] = [];

        const hasher = new InProcessTaskHasher({
            onDiagnostic: (taskId, message) => {
                diagnostics.push({ message, taskId });
            },
            projects: {
                "lib-a": {
                    root: "packages/lib-a",
                    targets: { build: { inputs: ["{projectRoot}/does-not-exist/**/*"] } },
                },
            },
            workspaceRoot,
        });

        const task: Task = {
            cache: true,
            id: "lib-a:build",
            outputs: [],
            overrides: {},
            target: { project: "lib-a", target: "build" },
        };

        await hasher.hashTask(task);

        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0]?.taskId).toBe("lib-a:build");
    });

    it("should not emit a diagnostic when file-set inputs resolve to real files", async () => {
        expect.assertions(1);

        const diagnostics: { message: string; taskId: string }[] = [];

        const hasher = new InProcessTaskHasher({
            onDiagnostic: (taskId, message) => {
                diagnostics.push({ message, taskId });
            },
            projects: {
                "lib-a": {
                    root: "packages/lib-a",
                    targets: { build: { inputs: ["{projectRoot}/**/*"] } },
                },
            },
            workspaceRoot,
        });

        const task: Task = {
            cache: true,
            id: "lib-a:build",
            outputs: [],
            overrides: {},
            target: { project: "lib-a", target: "build" },
        };

        await hasher.hashTask(task);

        expect(diagnostics).toHaveLength(0);
    });

    it("should not emit a diagnostic for a non-cacheable task with empty file-set inputs", async () => {
        expect.assertions(1);

        const diagnostics: { message: string; taskId: string }[] = [];

        const hasher = new InProcessTaskHasher({
            onDiagnostic: (taskId, message) => {
                diagnostics.push({ message, taskId });
            },
            projects: {
                "lib-a": {
                    root: "packages/lib-a",
                    targets: { build: { inputs: ["{projectRoot}/does-not-exist/**/*"] } },
                },
            },
            workspaceRoot,
        });

        const task: Task = {
            cache: false,
            id: "lib-a:build",
            outputs: [],
            overrides: {},
            target: { project: "lib-a", target: "build" },
        };

        await hasher.hashTask(task);

        expect(diagnostics).toHaveLength(0);
    });

    it("should produce different command hashes for different overrides", async () => {
        expect.assertions(1);

        const hasher = new InProcessTaskHasher({
            projects: {
                "lib-a": { root: "packages/lib-a" },
            },
            workspaceRoot,
        });

        const task1: Task = {
            id: "lib-a:build",
            outputs: [],
            overrides: { mode: "dev" },
            target: { project: "lib-a", target: "build" },
        };

        const task2: Task = {
            id: "lib-a:build",
            outputs: [],
            overrides: { mode: "prod" },
            target: { project: "lib-a", target: "build" },
        };

        const details1 = await hasher.hashTask(task1);
        const details2 = await hasher.hashTask(task2);

        expect(details1.command).not.toBe(details2.command);
    });

    it("should include environment variables in hash", async () => {
        expect.assertions(2);

        process.env["TEST_VAR_HASHER"] = "value1";

        const hasher = new InProcessTaskHasher({
            envVars: ["TEST_VAR_HASHER"],
            projects: { "lib-a": { root: "packages/lib-a" } },
            workspaceRoot,
        });

        const task: Task = {
            id: "lib-a:build",
            outputs: [],
            overrides: {},
            target: { project: "lib-a", target: "build" },
        };

        const details = await hasher.hashTask(task);

        expect(details.runtime).toBeDefined();
        expect((details.runtime as Record<string, string>)["env:TEST_VAR_HASHER"]).toBeDefined();

        delete process.env["TEST_VAR_HASHER"];
    });

    it("should use smart lockfile hashing when enabled", async () => {
        expect.assertions(2);

        // Create a lockfile
        await writeFile(
            join(workspaceRoot, "package-lock.json"),
            JSON.stringify({
                lockfileVersion: 3,
                packages: {
                    "node_modules/express": { version: "4.18.2" },
                    "node_modules/lodash": { version: "4.17.21" },
                },
            }),
        );

        // lib-a depends on lodash only
        await writeFile(
            join(workspaceRoot, "packages/lib-a/package.json"),
            JSON.stringify({
                dependencies: { lodash: "^4.17.0" },
                name: "lib-a",
            }),
        );

        const hasher = new InProcessTaskHasher({
            projects: { "lib-a": { root: "packages/lib-a" } },
            smartLockfileHashing: true,
            workspaceRoot,
        });

        const task: Task = {
            id: "lib-a:build",
            outputs: [],
            overrides: {},
            target: { project: "lib-a", target: "build" },
        };

        const details = await hasher.hashTask(task);

        // Should have a __lockfile__ implicit dep
        expect(details.implicitDeps).toBeDefined();
        expect((details.implicitDeps as Record<string, string>)["__lockfile__"]).toBeDefined();
    });

    it("should produce different lockfile hashes for different resolved versions", async () => {
        expect.assertions(1);

        await writeFile(
            join(workspaceRoot, "packages/lib-a/package.json"),
            JSON.stringify({
                dependencies: { lodash: "^4.17.0" },
                name: "lib-a",
            }),
        );

        // First lockfile
        await writeFile(
            join(workspaceRoot, "package-lock.json"),
            JSON.stringify({
                lockfileVersion: 3,
                packages: { "node_modules/lodash": { version: "4.17.21" } },
            }),
        );

        const hasher1 = new InProcessTaskHasher({
            projects: { "lib-a": { root: "packages/lib-a" } },
            smartLockfileHashing: true,
            workspaceRoot,
        });

        const task: Task = {
            id: "lib-a:build",
            outputs: [],
            overrides: {},
            target: { project: "lib-a", target: "build" },
        };

        const details1 = await hasher1.hashTask(task);

        // Update lockfile with different version
        await writeFile(
            join(workspaceRoot, "package-lock.json"),
            JSON.stringify({
                lockfileVersion: 3,
                packages: { "node_modules/lodash": { version: "4.17.20" } },
            }),
        );

        const hasher2 = new InProcessTaskHasher({
            projects: { "lib-a": { root: "packages/lib-a" } },
            smartLockfileHashing: true,
            workspaceRoot,
        });

        const details2 = await hasher2.hashTask(task);

        expect((details1.implicitDeps as Record<string, string>)["__lockfile__"]).not.toBe((details2.implicitDeps as Record<string, string>)["__lockfile__"]);
    });

    it("should include framework env vars in hash when frameworkInference is enabled", async () => {
        expect.assertions(2);

        // Make lib-a a Next.js project
        await writeFile(
            join(workspaceRoot, "packages/lib-a/package.json"),
            JSON.stringify({
                dependencies: { next: "14.0.0", react: "18.2.0" },
                name: "lib-a",
            }),
        );

        process.env["NEXT_PUBLIC_API_URL"] = "https://api.example.com";

        const hasher = new InProcessTaskHasher({
            frameworkInference: true,
            projects: { "lib-a": { root: "packages/lib-a" } },
            workspaceRoot,
        });

        const task: Task = {
            id: "lib-a:build",
            outputs: [],
            overrides: {},
            target: { project: "lib-a", target: "build" },
        };

        const details = await hasher.hashTask(task);

        expect(details.runtime).toBeDefined();
        // eslint-disable-next-line no-secrets/no-secrets
        expect((details.runtime as Record<string, string>)["framework-env:NEXT_PUBLIC_API_URL"]).toBeDefined();

        delete process.env["NEXT_PUBLIC_API_URL"];
    });

    it("should not include framework env vars when frameworkInference is disabled", async () => {
        expect.assertions(1);

        await writeFile(
            join(workspaceRoot, "packages/lib-a/package.json"),
            JSON.stringify({
                dependencies: { next: "14.0.0" },
                name: "lib-a",
            }),
        );

        process.env["NEXT_PUBLIC_TEST"] = "value";

        const hasher = new InProcessTaskHasher({
            frameworkInference: false,
            projects: { "lib-a": { root: "packages/lib-a" } },
            workspaceRoot,
        });

        const task: Task = {
            id: "lib-a:build",
            outputs: [],
            overrides: {},
            target: { project: "lib-a", target: "build" },
        };

        const details = await hasher.hashTask(task);

        const frameworkKeys = Object.keys(details.runtime ?? {}).filter((k) => k.startsWith("framework-env:"));

        expect(frameworkKeys).toHaveLength(0);

        delete process.env["NEXT_PUBLIC_TEST"];
    });

    it("should use named inputs when configured", async () => {
        expect.assertions(2);

        const hasher = new InProcessTaskHasher({
            namedInputs: {
                production: ["{projectRoot}/src/**/*"],
            },
            projects: {
                "lib-a": {
                    root: "packages/lib-a",
                    targets: {
                        build: {
                            inputs: ["production"],
                        },
                    },
                },
            },
            workspaceRoot,
        });

        const task: Task = {
            id: "lib-a:build",
            outputs: [],
            overrides: {},
            target: { project: "lib-a", target: "build" },
        };

        const details = await hasher.hashTask(task);

        // Should only include src files, not package.json
        const paths = Object.keys(details.nodes);

        expect(paths.some((p) => p.includes("src/index.ts"))).toBe(true);
        expect(paths).not.toContain("packages/lib-a/package.json");
    });

    it("honours the glob suffix so only matching extensions enter the input set", async () => {
        expect.assertions(3);

        // Two non-.ts siblings under src/: the pattern's `*.ts` suffix must
        // exclude them. Previously only the non-glob prefix (`src`) survived
        // and every file under it was hashed regardless of extension.
        await writeFile(join(workspaceRoot, "packages/lib-a/src/README.md"), "# docs");
        await writeFile(join(workspaceRoot, "packages/lib-a/src/data.json"), "{}");

        const hasher = new InProcessTaskHasher({
            projects: {
                "lib-a": {
                    root: "packages/lib-a",
                    targets: {
                        build: {
                            inputs: ["{projectRoot}/src/**/*.ts"],
                        },
                    },
                },
            },
            workspaceRoot,
        });

        const task: Task = {
            id: "lib-a:build",
            outputs: [],
            overrides: {},
            target: { project: "lib-a", target: "build" },
        };

        const paths = Object.keys((await hasher.hashTask(task)).nodes);

        expect(paths.some((p) => p.includes("src/index.ts"))).toBe(true);
        expect(paths.some((p) => p.includes("src/README.md"))).toBe(false);
        expect(paths.some((p) => p.includes("src/data.json"))).toBe(false);
    });

    it("excludes non-matching extensions with a project-wide recursive glob", async () => {
        expect.assertions(2);

        // `{projectRoot}/**/*.ts` must exclude a sibling `.js` file: without
        // suffix filtering the recursive glob degraded to "everything under
        // the project root", so unrelated files busted the cache.
        await writeFile(join(workspaceRoot, "packages/lib-a/build.js"), "module.exports = {};");

        const hasher = new InProcessTaskHasher({
            projects: {
                "lib-a": {
                    root: "packages/lib-a",
                    targets: {
                        build: {
                            inputs: ["{projectRoot}/**/*.ts"],
                        },
                    },
                },
            },
            workspaceRoot,
        });

        const task: Task = {
            id: "lib-a:build",
            outputs: [],
            overrides: {},
            target: { project: "lib-a", target: "build" },
        };

        const paths = Object.keys((await hasher.hashTask(task)).nodes);

        expect(paths.some((p) => p.includes("src/index.ts"))).toBe(true);
        expect(paths.some((p) => p.includes("build.js"))).toBe(false);
    });

    it("should resolve object-form filesets with base 'workspace'", async () => {
        expect.assertions(2);

        await writeFile(join(workspaceRoot, "tsconfig.base.json"), '{"compilerOptions":{}}');

        const hasher = new InProcessTaskHasher({
            projects: {
                "lib-a": {
                    root: "packages/lib-a",
                    targets: {
                        build: {
                            inputs: [{ fileset: { base: "workspace", pattern: "tsconfig.base.json" } }],
                        },
                    },
                },
            },
            workspaceRoot,
        });

        const task: Task = {
            id: "lib-a:build",
            outputs: [],
            overrides: {},
            target: { project: "lib-a", target: "build" },
        };

        const details = await hasher.hashTask(task);
        const paths = Object.keys(details.nodes);

        expect(paths).toContain("tsconfig.base.json");
        expect(paths.some((p) => p.startsWith("packages/lib-a"))).toBe(false);
    });

    it("auto-fingerprints env vars referenced in the command when autoEnvVars is true", async () => {
        expect.assertions(2);

        process.env["MY_REFERENCED_VAR"] = "initial-value";

        const hasher = new InProcessTaskHasher({
            autoEnvVars: true,
            projects: {
                "lib-a": {
                    root: "packages/lib-a",
                    targets: {
                        build: { command: "echo $MY_REFERENCED_VAR" },
                    },
                },
            },
            workspaceRoot,
        });

        const task: Task = {
            id: "lib-a:build",
            outputs: [],
            overrides: {},
            target: { project: "lib-a", target: "build" },
        };

        const hash1 = await hasher.hashTask(task);

        process.env["MY_REFERENCED_VAR"] = "changed";

        // Clear internal file cache isn't enough — we need a fresh hasher
        // so the runtime entry is recomputed against the new env value.
        const hasher2 = new InProcessTaskHasher({
            autoEnvVars: true,
            projects: {
                "lib-a": {
                    root: "packages/lib-a",
                    targets: {
                        build: { command: "echo $MY_REFERENCED_VAR" },
                    },
                },
            },
            workspaceRoot,
        });

        const hash2 = await hasher2.hashTask(task);

        expect(hash1.runtime?.["env:MY_REFERENCED_VAR"]).toBeDefined();
        expect(hash1.runtime?.["env:MY_REFERENCED_VAR"]).not.toBe(hash2.runtime?.["env:MY_REFERENCED_VAR"]);

        delete process.env["MY_REFERENCED_VAR"];
    });

    it("does not auto-fingerprint env vars when autoEnvVars is false (default)", async () => {
        expect.assertions(1);

        const hasher = new InProcessTaskHasher({
            projects: {
                "lib-a": {
                    root: "packages/lib-a",
                    targets: {
                        build: { command: "echo $SOME_VAR" },
                    },
                },
            },
            workspaceRoot,
        });

        const task: Task = {
            id: "lib-a:build",
            outputs: [],
            overrides: {},
            target: { project: "lib-a", target: "build" },
        };

        const hash = await hasher.hashTask(task);

        expect(hash.runtime?.["env:SOME_VAR"]).toBeUndefined();
    });

    it("should honor workspace-base negation in object form", async () => {
        expect.assertions(1);

        await mkdir(join(workspaceRoot, "packages/lib-a/dist"), { recursive: true });
        await writeFile(join(workspaceRoot, "packages/lib-a/dist/out.js"), "built");

        const hasher = new InProcessTaskHasher({
            projects: {
                "lib-a": {
                    root: "packages/lib-a",
                    targets: {
                        build: {
                            inputs: ["{projectRoot}/**/*", { fileset: { base: "workspace", pattern: "!packages/lib-a/dist" } }],
                        },
                    },
                },
            },
            workspaceRoot,
        });

        const task: Task = {
            id: "lib-a:build",
            outputs: [],
            overrides: {},
            target: { project: "lib-a", target: "build" },
        };

        const details = await hasher.hashTask(task);

        expect(Object.keys(details.nodes).some((p) => p.includes("dist/out.js"))).toBe(false);
    });

    it("expands URI-form input strings into their structured equivalents", async () => {
        expect.assertions(3);

        process.env["URI_TEST_VAR"] = "uri-value";

        const hasher = new InProcessTaskHasher({
            projects: {
                "lib-a": {
                    root: "packages/lib-a",
                    targets: {
                        build: {
                            inputs: ["glob://{projectRoot}/src/**/*", "env://URI_TEST_VAR"],
                        },
                    },
                },
            },
            workspaceRoot,
        });

        const task: Task = {
            id: "lib-a:build",
            outputs: [],
            overrides: {},
            target: { project: "lib-a", target: "build" },
        };

        const details = await hasher.hashTask(task);

        expect(Object.keys(details.nodes).some((p) => p.includes("src/index.ts"))).toBe(true);
        expect(details.runtime?.["env:URI_TEST_VAR"]).toBeDefined();
        // package.json is at projectRoot, not under src/, so the URI glob should exclude it.
        expect(Object.keys(details.nodes)).not.toContain("packages/lib-a/package.json");

        delete process.env["URI_TEST_VAR"];
    });

    it("hashes URI form identically to its equivalent object form", async () => {
        expect.assertions(2);

        const uriHasher = new InProcessTaskHasher({
            projects: {
                "lib-a": {
                    root: "packages/lib-a",
                    targets: {
                        build: {
                            inputs: ["glob://{projectRoot}/src/**/*"],
                        },
                    },
                },
            },
            workspaceRoot,
        });

        const objectHasher = new InProcessTaskHasher({
            projects: {
                "lib-a": {
                    root: "packages/lib-a",
                    targets: {
                        build: {
                            inputs: [{ fileset: "{projectRoot}/src/**/*" }],
                        },
                    },
                },
            },
            workspaceRoot,
        });

        const task: Task = {
            id: "lib-a:build",
            outputs: [],
            overrides: {},
            target: { project: "lib-a", target: "build" },
        };

        const uriDetails = await uriHasher.hashTask(task);
        const objectDetails = await objectHasher.hashTask(task);

        expect(uriDetails.nodes).toStrictEqual(objectDetails.nodes);
        expect(computeTaskHash(uriDetails)).toBe(computeTaskHash(objectDetails));
    });

    it("expands URI strings inside named-input refs", async () => {
        expect.assertions(2);

        process.env["URI_NAMED_VAR"] = "named-value";

        const hasher = new InProcessTaskHasher({
            namedInputs: {
                production: ["glob://{projectRoot}/src/**/*", "env://URI_NAMED_VAR"],
            },
            projects: {
                "lib-a": {
                    root: "packages/lib-a",
                    targets: {
                        build: { inputs: ["production"] },
                    },
                },
            },
            workspaceRoot,
        });

        const task: Task = {
            id: "lib-a:build",
            outputs: [],
            overrides: {},
            target: { project: "lib-a", target: "build" },
        };

        const details = await hasher.hashTask(task);

        expect(Object.keys(details.nodes).some((p) => p.includes("src/index.ts"))).toBe(true);
        expect(details.runtime?.["env:URI_NAMED_VAR"]).toBeDefined();

        delete process.env["URI_NAMED_VAR"];
    });

    it("surfaces unknown URI schemes as an InvalidInputUriError", async () => {
        expect.assertions(1);

        const hasher = new InProcessTaskHasher({
            projects: {
                "lib-a": {
                    root: "packages/lib-a",
                    targets: {
                        build: {
                            inputs: ["typo://oops"],
                        },
                    },
                },
            },
            workspaceRoot,
        });

        const task: Task = {
            id: "lib-a:build",
            outputs: [],
            overrides: {},
            target: { project: "lib-a", target: "build" },
        };

        await expect(hasher.hashTask(task)).rejects.toThrow(/Unknown input URI scheme/);
    });

    it("should mix onFingerprint contributions into the runtime bucket", async () => {
        expect.assertions(2);

        const seen: { task: string }[] = [];

        const hasher = new InProcessTaskHasher({
            onFingerprint: (task, contributor) => {
                seen.push({ task: task.id });
                contributor.contribute("vis-plugin", "schema-version-7");
            },
            projects: { "lib-a": { root: "packages/lib-a" } },
            workspaceRoot,
        });

        const task: Task = {
            id: "lib-a:build",
            outputs: [],
            overrides: {},
            target: { project: "lib-a", target: "build" },
        };

        const details = await hasher.hashTask(task);

        expect(seen).toStrictEqual([{ task: "lib-a:build" }]);
        // Contributions are namespaced under `plugin:` so they can't
        // collide with built-in env: / framework-env: / runtime keys.
        expect(details.runtime?.["plugin:vis-plugin"]).toBeDefined();

        expectTypeOf(details.runtime?.["plugin:vis-plugin"]).toBeString();
    });

    it("should hash differently when contributions change value", async () => {
        expect.assertions(1);

        const makeHasher = (value: string) =>
            new InProcessTaskHasher({
                onFingerprint: (_task, contributor) => {
                    contributor.contribute("schema", value);
                },
                projects: { "lib-a": { root: "packages/lib-a" } },
                workspaceRoot,
            });

        const task: Task = {
            id: "lib-a:build",
            outputs: [],
            overrides: {},
            target: { project: "lib-a", target: "build" },
        };

        const a = await makeHasher("v1").hashTask(task);
        const b = await makeHasher("v2").hashTask(task);

        expect(a.runtime?.["plugin:schema"]).not.toBe(b.runtime?.["plugin:schema"]);
    });

    it("should be order-independent across contribution calls", async () => {
        expect.assertions(1);

        const makeHasher = (order: ("a" | "b")[]) =>
            new InProcessTaskHasher({
                onFingerprint: (_task, contributor) => {
                    for (const k of order) {
                        contributor.contribute(k, `${k}-value`);
                    }
                },
                projects: { "lib-a": { root: "packages/lib-a" } },
                workspaceRoot,
            });

        const task: Task = {
            id: "lib-a:build",
            outputs: [],
            overrides: {},
            target: { project: "lib-a", target: "build" },
        };

        const forward = computeTaskHash(await makeHasher(["a", "b"]).hashTask(task));
        const reverse = computeTaskHash(await makeHasher(["b", "a"]).hashTask(task));

        // computeTaskHash sorts keys before mixing, so the order in
        // which the plugin called contribute() must not matter.
        expect(forward).toBe(reverse);
    });

    it("should reject empty / non-string keys at the contribute() boundary", async () => {
        expect.assertions(2);

        const makeHasher = (badCall: (c: FingerprintContributor) => void) =>
            new InProcessTaskHasher({
                onFingerprint: (_t, contributor) => {
                    badCall(contributor);
                },
                projects: { "lib-a": { root: "packages/lib-a" } },
                workspaceRoot,
            });

        const task: Task = {
            id: "lib-a:build",
            outputs: [],
            overrides: {},
            target: { project: "lib-a", target: "build" },
        };

        await expect(
            // @ts-expect-error -- runtime check for plugins without TS
            makeHasher((c) => {
                c.contribute("", "v");
            }).hashTask(task),
        ).rejects.toThrow(/non-empty string key/);

        await expect(
            // @ts-expect-error -- runtime check for plugins without TS
            makeHasher((c) => {
                c.contribute("schema", undefined);
            }).hashTask(task),
        ).rejects.toThrow(/string value/);
    });

    it("should propagate onFingerprint throws so the task fails before cache lookup", async () => {
        expect.assertions(1);

        const hasher = new InProcessTaskHasher({
            onFingerprint: () => {
                throw new Error("plugin blew up");
            },
            projects: { "lib-a": { root: "packages/lib-a" } },
            workspaceRoot,
        });

        const task: Task = {
            id: "lib-a:build",
            outputs: [],
            overrides: {},
            target: { project: "lib-a", target: "build" },
        };

        await expect(hasher.hashTask(task)).rejects.toThrow("plugin blew up");
    });
});

describe(computeTaskHash, () => {
    it("should produce deterministic hash", () => {
        expect.assertions(1);

        const details: TaskHashDetails = {
            command: "abc",
            nodes: { file1: "hash1", file2: "hash2" },
        };

        const hash1 = computeTaskHash(details);
        const hash2 = computeTaskHash(details);

        expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different inputs", () => {
        expect.assertions(1);

        const details1: TaskHashDetails = {
            command: "abc",
            nodes: { file1: "hash1" },
        };

        const details2: TaskHashDetails = {
            command: "abc",
            nodes: { file1: "hash2" },
        };

        expect(computeTaskHash(details1)).not.toBe(computeTaskHash(details2));
    });

    it("should be order-independent for nodes", () => {
        expect.assertions(1);

        const details1: TaskHashDetails = {
            command: "abc",
            nodes: { a: "1", b: "2" },
        };

        const details2: TaskHashDetails = {
            command: "abc",
            nodes: { a: "1", b: "2" },
        };

        expect(computeTaskHash(details1)).toBe(computeTaskHash(details2));
    });

    it("should fold implicitDeps into the hash so lockfile/dependency changes invalidate the cache", () => {
        // Regression: the native struct field is camelCased by NAPI (`implicitDeps`).
        // If the call site or binding type uses snake_case `implicit_deps`, the value is
        // silently dropped and these two would collide — meaning a changed lockfile hash
        // would NOT invalidate the cache.
        expect.assertions(2);

        const base: TaskHashDetails = {
            command: "abc",
            nodes: { file1: "hash1" },
        };

        const withDeps: TaskHashDetails = {
            ...base,
            implicitDeps: { __lockfile__: "lock-v1" },
        };

        const withChangedDeps: TaskHashDetails = {
            ...base,
            implicitDeps: { __lockfile__: "lock-v2" },
        };

        expect(computeTaskHash(withDeps)).not.toBe(computeTaskHash(base));
        expect(computeTaskHash(withDeps)).not.toBe(computeTaskHash(withChangedDeps));
    });
});
