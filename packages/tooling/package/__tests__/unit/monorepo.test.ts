import { fileURLToPath } from "node:url";

import { JSONError } from "@visulima/fs/error";
import { dirname, join } from "@visulima/path";
import { temporaryDirectory } from "tempy";
import { describe, expect, it } from "vitest";

import type { RootMonorepo } from "../../src/monorepo";
import { findMonorepoRoot, findMonorepoRootSync } from "../../src/monorepo";

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
                    result = await (result as Promise<RootMonorepo>);
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
                    result = await (result as Promise<RootMonorepo>);
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
                    result = await (result as Promise<RootMonorepo>);
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
                    result = await (result as Promise<RootMonorepo>);
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
                await expect(async () => await _function(join(temporaryDirectory(), "packages", "package-a"))).rejects.toThrow(
                    /No monorepo root could be found upwards/,
                );
            } else {
                // eslint-disable-next-line vitest/no-conditional-expect
                expect(() => (_function as typeof findMonorepoRootSync)(temporaryDirectory())).toThrow(/No monorepo root could be found upwards/);
            }
        });

        it("should throw error when package.json is broken", async () => {
            expect.assertions(1);

            // eslint-disable-next-line vitest/no-conditional-in-test
            if (name === "findMonorepoRoot") {
                // eslint-disable-next-line vitest/no-conditional-expect
                await expect(async () => await _function(join(cwd, "bad"))).rejects.toThrow(JSONError);
            } else {
                // eslint-disable-next-line vitest/no-conditional-expect
                expect(() => (_function as typeof findMonorepoRootSync)(join(cwd, "bad"))).toThrow(JSONError);
            }
        });
    });
});
