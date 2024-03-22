import { platform } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import package_ from "../../package.json";
import { findPackageManager, getPackageManagerVersion } from "../../src/package-manager";
import { execa } from "execa";

const whichPMFixturePath = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "__fixtures__", "which-package-manager");

vi.mock("node:child_process", () => {
    return {
        execSync: (command: string) => {
            console.log(command);
            if (command === "npm --version") {
                return "7.0.15";
            }

            if (command === "yarn --version") {
                return "1.22.10";
            }

            return undefined;
        },
    };
});

delete process.env.npm_config_user_agent;

describe("package-manager", () => {
    describe("getPackageManagerVersion", () => {
        it("should return the package manager version", () => {
            expect.assertions(2);

            expect(getPackageManagerVersion("npm")).toBe("7.0.15");
            expect(getPackageManagerVersion("yarn")).toBe("1.22.10");
        });
    });

    describe("findPackageManager", () => {
        it("detects yarn", async () => {
            expect.assertions(1);

            await expect(findPackageManager(join(whichPMFixturePath, "yarn"))).resolves.toStrictEqual({
                packageManager: "yarn",
                path: join(whichPMFixturePath, "yarn"),
            });
        });

        it.skipIf(platform() === "win32" || package_.devDependencies.bun === undefined)("should detect bun", async () => {
            expect.assertions(1);

            await expect(findPackageManager(join(whichPMFixturePath, "bun"))).resolves.toStrictEqual({
                packageManager: "bun",
                path: join(whichPMFixturePath, "bun"),
            });
        });

        it("should detect npm", async () => {
            expect.assertions(1);

            await expect(findPackageManager(join(whichPMFixturePath, "npm"))).resolves.toStrictEqual({
                packageManager: "npm",
                path: join(whichPMFixturePath, "npm"),
            });
        });

        it("should detect pnpm", async () => {
            expect.assertions(1);

            await expect(findPackageManager(join(whichPMFixturePath, "pnpm"))).resolves.toStrictEqual({
                packageManager: "pnpm",
                path: join(whichPMFixturePath, "pnpm"),
            });
        });

        it("should detect cnpm", async () => {
            expect.assertions(1);

            await expect(findPackageManager(join(whichPMFixturePath, "npm"))).resolves.toStrictEqual({
                packageManager: "npm",
                path: join(whichPMFixturePath, "npm"),
            });
        });
    });

    describe("identifyInitiatingPackageManager", () => {
        it.skipIf(platform() === "win32" || package_.devDependencies.bun === undefined)("should detect bun", async () => {
            expect.assertions(1);

            const { stdout } = await execa("bun", ["install"], { cwd: join(whichPMFixturePath, "bun") });

            expect(stdout).toBeDefined();
        });

        it("should detect npm", async () => {
            expect.assertions(1);

            const { stdout } = await execa("npm", ["install"], { cwd: join(whichPMFixturePath, "npm") });

            expect(stdout).toBeDefined();
        });

        it("should detect pnpm", async () => {
            expect.assertions(1);

            const { stdout } = await execa("pnpm", ["install"], { cwd: join(whichPMFixturePath, "pnpm") });

            expect(stdout).toBeDefined();
        });
    });
});
