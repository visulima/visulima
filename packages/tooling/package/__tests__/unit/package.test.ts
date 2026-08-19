import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";

import { writeFileSync, writeJsonSync } from "@visulima/fs";
import { join, toNamespacedPath } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { findPackageRoot, findPackageRootSync } from "../../src/package";

describe("package", () => {
    let distribution: string;

    beforeEach(() => {
        distribution = toNamespacedPath(mkdtempSync(join(tmpdir(), "visulima-package-")));
    });

    afterEach(async () => {
        await rm(distribution, { recursive: true });
    });

    describe.each([
        ["findPackageRoot", findPackageRoot],
        ["findPackageRootSync", findPackageRootSync],
    ])("%s", (name, function_) => {
        it.each(["yarn.lock", "package-lock.json"])(`should find "%s" lock file`, async (fileName) => {
            expect.assertions(1);

            writeJsonSync(join(distribution, fileName), {});

            let result = function_(distribution);

            // eslint-disable-next-line vitest/no-conditional-in-test
            if (name === "findPackageRoot") {
                result = await result;
            }

            expect(result).toBe(distribution);
        });

        it("should find git config", async () => {
            expect.assertions(1);

            writeFileSync(join(distribution, ".git", "config"), "");

            let result = function_(distribution);

            // eslint-disable-next-line vitest/no-conditional-in-test
            if (name === "findPackageRoot") {
                result = await result;
            }

            expect(result).toBe(distribution);
        });

        it("should find package.json", async () => {
            expect.assertions(1);

            writeJsonSync(join(distribution, "package.json"), {
                name: "test",
            });

            let result = function_(distribution);

            // eslint-disable-next-line vitest/no-conditional-in-test
            if (name === "findPackageRoot") {
                result = await result;
            }

            expect(result).toBe(distribution);
        });

        it("should find the root of a linked git worktree", async () => {
            expect.assertions(1);

            // `git worktree add` writes `.git` as a *file* holding a `gitdir:`
            // pointer, so there is no `.git/config` beside it. Looking for the
            // config walked straight past this root — and, with the worktree
            // placed inside another repository, landed on that one instead.
            const outerRepository = join(distribution, "outer");
            const worktree = join(outerRepository, "linked");

            writeFileSync(join(outerRepository, ".git", "config"), "[core]\n");
            writeFileSync(join(worktree, ".git"), `gitdir: ${join(outerRepository, ".git", "worktrees", "linked")}\n`);

            let result = function_(worktree);

            // eslint-disable-next-line vitest/no-conditional-in-test
            if (name === "findPackageRoot") {
                result = await result;
            }

            expect(result).toBe(worktree);
        });

        it("should throw a error when the found package.json has no name", async () => {
            expect.assertions(1);

            writeJsonSync(join(distribution, "package.json"), {});

            // eslint-disable-next-line vitest/no-conditional-in-test
            if (name === "findPackageRoot") {
                // eslint-disable-next-line vitest/no-conditional-expect
                await expect(function_(distribution)).rejects.toThrow("Could not find root directory");
            } else {
                // eslint-disable-next-line vitest/no-conditional-expect
                expect(() => function_(distribution)).toThrow("Could not find root directory");
            }
        });

        it("should throw a error when no root directory is found", async () => {
            expect.assertions(1);

            // eslint-disable-next-line vitest/no-conditional-in-test
            if (name === "findPackageRoot") {
                // eslint-disable-next-line vitest/no-conditional-expect
                await expect(function_(distribution)).rejects.toThrow("Could not find root directory");
            } else {
                // eslint-disable-next-line vitest/no-conditional-expect
                expect(() => function_(distribution)).toThrow("Could not find root directory");
            }
        });
    });
});
