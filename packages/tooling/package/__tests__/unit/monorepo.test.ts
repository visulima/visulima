import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { JSONError } from "@visulima/fs/error";
import { dirname, join } from "@visulima/path";
import { afterEach, describe, expect, it } from "vitest";

import type { RootMonorepo } from "../../src/monorepo";
import { findMonorepoRoot, findMonorepoRootSync } from "../../src/monorepo";

const NO_MONOREPO_ROOT_REGEX = /No monorepo root could be found upwards/;

const cwd = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "__fixtures__", "workspaces");
const packages = ["package-a", "package-b", "package-c"];
const scenarios = ["pnpm", "yarn", "turbo-pnpm", "turbo-yarn", "turbo-npm", "yarn-packageManager", "npm", "lerna", "lerna-sub-yarn-packageManager"];

describe("monorepo", () => {
    describe.each([
        ["findMonorepoRoot", findMonorepoRoot],
        ["findMonorepoRootSync", findMonorepoRootSync],
    ])("%s", (name, _function) => {
        describe.each(scenarios)(`using scenario %s`, (scenario) => {
            const strategy = scenario.includes("-") ? scenario.split("-")[0] : scenario;

            it.each(packages)(`from subdirectory ${scenario}/packages/%s`, async (package_) => {
                expect.assertions(2);

                const root = join(cwd, scenario);

                let result = _function(join(root, "packages", package_));

                // eslint-disable-next-line vitest/no-conditional-in-test
                if (name === "findMonorepoRoot") {
                    result = await result;
                }

                expect((result as RootMonorepo).strategy).toBe(strategy);
                expect((result as RootMonorepo).path).toBe(root);
            });

            it(`from .`, async () => {
                expect.assertions(2);

                const root = join(cwd, scenario);

                let result = _function(root);

                // eslint-disable-next-line vitest/no-conditional-in-test
                if (name === "findMonorepoRoot") {
                    result = await result;
                }

                expect((result as RootMonorepo).strategy).toBe(strategy);
                expect((result as RootMonorepo).path).toBe(root);
            });

            it(`from non-package root subdirectory '${scenario}/packages/package-a/scripts'`, async () => {
                expect.assertions(2);

                const root = join(cwd, scenario);

                let result = _function(join(root, "packages", "package-a", "scripts"));

                // eslint-disable-next-line vitest/no-conditional-in-test
                if (name === "findMonorepoRoot") {
                    result = await result;
                }

                expect((result as RootMonorepo).strategy).toBe(strategy);
                expect((result as RootMonorepo).path).toBe(root);
            });

            it(`from non-package root from subdirectory '${scenario}/scripts'`, async () => {
                expect.assertions(2);

                const root = join(cwd, scenario);

                let result = _function(join(root, "scripts"));

                // eslint-disable-next-line vitest/no-conditional-in-test
                if (name === "findMonorepoRoot") {
                    result = await result;
                }

                expect((result as RootMonorepo).strategy).toBe(strategy);
                expect((result as RootMonorepo).path).toBe(root);
            });
        });

        it(`should throw error when no match is found`, async () => {
            expect.assertions(1);

            // eslint-disable-next-line vitest/no-conditional-in-test
            if (name === "findMonorepoRoot") {
                // eslint-disable-next-line vitest/no-conditional-expect
                await expect(_function(join(mkdtempSync(join(tmpdir(), "visulima-package-")), "packages", "package-a"))).rejects.toThrow(
                    NO_MONOREPO_ROOT_REGEX,
                );
            } else {
                // eslint-disable-next-line vitest/no-conditional-expect
                expect(() => (_function as typeof findMonorepoRootSync)(mkdtempSync(join(tmpdir(), "visulima-package-")))).toThrow(NO_MONOREPO_ROOT_REGEX);
            }
        });

        it("should throw error when package.json is broken", async () => {
            expect.assertions(1);

            // eslint-disable-next-line vitest/no-conditional-in-test
            if (name === "findMonorepoRoot") {
                // eslint-disable-next-line vitest/no-conditional-expect
                await expect(_function(join(cwd, "bad"))).rejects.toThrow(JSONError);
            } else {
                // eslint-disable-next-line vitest/no-conditional-expect
                expect(() => (_function as typeof findMonorepoRootSync)(join(cwd, "bad"))).toThrow(JSONError);
            }
        });

        describe("non-monorepo fall-through cases", () => {
            let temporaryDirectory: string;

            afterEach(() => {
                rmSync(temporaryDirectory, { force: true, recursive: true });
            });

            // `await` resolves the async function's promise and is a no-op for
            // the sync function's plain return value, so a single helper covers
            // both variants without branching on the name.
            const run = async (target: string): Promise<RootMonorepo> => _function(target);

            it("should throw when lerna.json is an array (not a workspace object)", async () => {
                expect.assertions(1);

                temporaryDirectory = mkdtempSync(join(tmpdir(), "visulima-package-"));

                writeFileSync(join(temporaryDirectory, "lerna.json"), JSON.stringify([]));

                await expect(run(temporaryDirectory)).rejects.toThrow(NO_MONOREPO_ROOT_REGEX);
            });

            it("should throw when lerna.json has neither useWorkspaces nor packages", async () => {
                expect.assertions(1);

                temporaryDirectory = mkdtempSync(join(tmpdir(), "visulima-package-"));

                writeFileSync(join(temporaryDirectory, "lerna.json"), JSON.stringify({ version: "1.0.0" }));

                await expect(run(temporaryDirectory)).rejects.toThrow(NO_MONOREPO_ROOT_REGEX);
            });

            it("should throw for a yarn project whose package.json has no workspaces field", async () => {
                expect.assertions(1);

                temporaryDirectory = mkdtempSync(join(tmpdir(), "visulima-package-"));

                writeFileSync(join(temporaryDirectory, "yarn.lock"), "");
                writeFileSync(join(temporaryDirectory, "package.json"), JSON.stringify({ name: "single", version: "1.0.0" }));

                await expect(run(temporaryDirectory)).rejects.toThrow(NO_MONOREPO_ROOT_REGEX);
            });

            it("should throw when 'workspaces' only appears as a substring, not a real field", async () => {
                expect.assertions(1);

                temporaryDirectory = mkdtempSync(join(tmpdir(), "visulima-package-"));

                writeFileSync(join(temporaryDirectory, "yarn.lock"), "");
                writeFileSync(
                    join(temporaryDirectory, "package.json"),
                    JSON.stringify({
                        dependencies: { "eslint-plugin-workspaces": "^1.0.0" },
                        keywords: ["workspaces"],
                        name: "single",
                        version: "1.0.0",
                    }),
                );

                await expect(run(temporaryDirectory)).rejects.toThrow(NO_MONOREPO_ROOT_REGEX);
            });

            it("should fall through when lerna.json is null instead of crashing", async () => {
                expect.assertions(1);

                temporaryDirectory = mkdtempSync(join(tmpdir(), "visulima-package-"));

                // eslint-disable-next-line unicorn/no-null
                writeFileSync(join(temporaryDirectory, "lerna.json"), JSON.stringify(null));

                await expect(run(temporaryDirectory)).rejects.toThrow(NO_MONOREPO_ROOT_REGEX);
            });

            it("should throw for a pnpm project without a pnpm-workspace.yaml", async () => {
                expect.assertions(1);

                temporaryDirectory = mkdtempSync(join(tmpdir(), "visulima-package-"));

                writeFileSync(join(temporaryDirectory, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
                writeFileSync(join(temporaryDirectory, "package.json"), JSON.stringify({ name: "single", version: "1.0.0" }));

                await expect(run(temporaryDirectory)).rejects.toThrow(NO_MONOREPO_ROOT_REGEX);
            });

            it("should throw for a yarn lockfile with no package.json alongside it", async () => {
                expect.assertions(1);

                temporaryDirectory = mkdtempSync(join(tmpdir(), "visulima-package-"));

                // yarn.lock present but no package.json — the existsSync guard fails.
                writeFileSync(join(temporaryDirectory, "yarn.lock"), "");

                await expect(run(temporaryDirectory)).rejects.toThrow(NO_MONOREPO_ROOT_REGEX);
            });

            it("should throw for a bun project (no monorepo indicator handled)", async () => {
                expect.assertions(1);

                temporaryDirectory = mkdtempSync(join(tmpdir(), "visulima-package-"));

                // bun is neither npm/yarn nor pnpm, so neither workspace branch runs.
                writeFileSync(join(temporaryDirectory, "bun.lockb"), "");
                writeFileSync(join(temporaryDirectory, "package.json"), JSON.stringify({ name: "single", version: "1.0.0" }));

                await expect(run(temporaryDirectory)).rejects.toThrow(NO_MONOREPO_ROOT_REGEX);
            });
        });
    });
});
