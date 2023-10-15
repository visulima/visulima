import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import { findMonorepoRoot } from "../src/monorepo";

const cwd = join(dirname(fileURLToPath(import.meta.url)), `../__fixtures__/workspaces`);
const packages = ["package-a", "package-b", "package-c"];
const scenarios = ["pnpm", "yarn", "turbo-pnpm", "turbo-yarn", "turbo-npm", "yarn-packageManager", "npm", "lerna", "lerna-sub-yarn-packageManager"];

vi.mock("find-up", async (importOriginal) => {
    const module = await importOriginal();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return {
        // @ts-expect-error - types are wrong
        ...module,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        findUp: async (path: string | (() => any), options?: { cwd?: string }) => {
            if (options?.cwd.includes("noMatch")) {
                return undefined;
            }

            // @ts-expect-error - types are wrong
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-return
            return module.findUp(path, options);
        },
    };
});

describe("monorepo", () => {
    describe("findMonorepoRoot", () => {
        describe.each(scenarios)(`using scenario %s`, (scenario) => {
            const strategy = scenario.includes("-") ? scenario.split("-")[0] : scenario;

            it.each(packages)(`from subdirectory ${scenario}/packages/%s`, async (package_) => {
                const root = join(cwd, scenario);
                const result = await findMonorepoRoot(join(root, "packages", package_));

                expect(result.strategy).toBe(strategy);
                expect(result.path).toBe(root);
            });

            it(`from .`, async () => {
                const root = join(cwd, scenario);
                const result = await findMonorepoRoot(root);

                expect(result.strategy).toBe(strategy);
                expect(result.path).toBe(root);
            });

            it(`from non-package root subdirectory '${scenario}/packages/package-a/scripts'`, async () => {
                const root = join(cwd, scenario);
                const result = await findMonorepoRoot(join(root, "packages", "package-a", "scripts"));

                expect(result.strategy).toBe(strategy);
                expect(result.path).toBe(root);
            });

            it(`from non-package root from subdirectory '${scenario}/scripts'`, async () => {
                const root = join(cwd, scenario);

                const result = await findMonorepoRoot(join(root, "scripts"));

                expect(result.strategy).toBe(strategy);
                expect(result.path).toBe(root);
            });
        });

        it(`should throw error when no match is found`, async () => {
            const root = join(cwd, "noMatch");

            // eslint-disable-next-line @typescript-eslint/no-floating-promises,vitest/valid-expect,require-unicode-regexp
            expect(async () => await findMonorepoRoot(join(root, "packages", "package-a"))).rejects.toThrow(/No monorepo root could be found upwards/);
        });

        it("should throw error when package.json is broken", async () => {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises,vitest/valid-expect,require-unicode-regexp
            expect(async () => await findMonorepoRoot(join(cwd, "bad"))).rejects.toThrow(/Unexpected token "a"/);
        });
    });
});
