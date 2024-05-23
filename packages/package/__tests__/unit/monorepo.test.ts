import { fileURLToPath } from "node:url";

import { JSONError } from "@visulima/fs/error";
import { dirname, join } from "@visulima/path";
import { temporaryDirectory } from "tempy";
import { describe, expect, it } from "vitest";

import { findMonorepoRoot } from "../../src/monorepo";

const cwd = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "__fixtures__", "workspaces");
const packages = ["package-a", "package-b", "package-c"];
const scenarios = ["pnpm", "yarn", "turbo-pnpm", "turbo-yarn", "turbo-npm", "yarn-packageManager", "npm", "lerna", "lerna-sub-yarn-packageManager"];

describe("monorepo", () => {
    describe("findMonorepoRoot", () => {
        describe.each(scenarios)(`using scenario %s`, (scenario) => {
            const strategy = scenario.includes("-") ? scenario.split("-")[0] : scenario;

            it.each(packages)(`from subdirectory ${scenario}/packages/%s`, async (package_) => {
                expect.assertions(2);

                const root = join(cwd, scenario);
                const result = await findMonorepoRoot(join(root, "packages", package_));

                expect(result.strategy).toBe(strategy);
                expect(result.path).toBe(root);
            });

            it(`from .`, async () => {
                expect.assertions(2);

                const root = join(cwd, scenario);
                const result = await findMonorepoRoot(root);

                expect(result.strategy).toBe(strategy);
                expect(result.path).toBe(root);
            });

            it(`from non-package root subdirectory '${scenario}/packages/package-a/scripts'`, async () => {
                expect.assertions(2);

                const root = join(cwd, scenario);
                const result = await findMonorepoRoot(join(root, "packages", "package-a", "scripts"));

                expect(result.strategy).toBe(strategy);
                expect(result.path).toBe(root);
            });

            it(`from non-package root from subdirectory '${scenario}/scripts'`, async () => {
                expect.assertions(2);

                const root = join(cwd, scenario);

                const result = await findMonorepoRoot(join(root, "scripts"));

                expect(result.strategy).toBe(strategy);
                expect(result.path).toBe(root);
            });
        });

        it(`should throw error when no match is found`, async () => {
            expect.assertions(1);

            await expect(async () => await findMonorepoRoot(join(temporaryDirectory(), "packages", "package-a"))).rejects.toThrow(
                /No monorepo root could be found upwards/,
            );
        });

        it("should throw error when package.json is broken", async () => {
            expect.assertions(1);

            await expect(async () => await findMonorepoRoot(join(cwd, "bad"))).rejects.toThrow(JSONError);
        });
    });
});
