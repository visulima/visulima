import { platform } from "node:os";
import { fileURLToPath } from "node:url";

import { dirname, join } from "@visulima/path";
import { execa } from "execa";
import { describe, expect, it, vi } from "vitest";

import package_ from "../../package.json";
import type { PackageManager } from "../../src/package-manager";
import { findPackageManager, findPackageManagerSync, generateMissingPackagesInstallMessage, getPackageManagerVersion } from "../../src/package-manager";

const whichPMFixturePath = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "__fixtures__", "which-package-manager");

// eslint-disable-next-line vitest/prefer-import-in-mock
vi.mock("node:child_process", () => {
    return {
        execSync: (command: string) => {
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
    describe(getPackageManagerVersion, () => {
        it("should return the package manager version", () => {
            expect.assertions(2);

            expect(getPackageManagerVersion("npm")).toBe("7.0.15");
            expect(getPackageManagerVersion("yarn")).toBe("1.22.10");
        });
    });

    describe.each([
        ["findPackageManager", findPackageManager],
        ["findPackageManagerSync", findPackageManagerSync],
    ])("%s", (name, function_) => {
        it("detects yarn", async () => {
            expect.assertions(1);

            let result = function_(join(whichPMFixturePath, "yarn"));

            // eslint-disable-next-line vitest/no-conditional-in-test
            if (name === "findPackageManager") {
                result = await result;
            }

            expect(result).toStrictEqual({
                packageManager: "yarn",
                path: join(whichPMFixturePath, "yarn"),
            });
        });

        it("should detect bun", async () => {
            expect.assertions(1);

            let result = function_(join(whichPMFixturePath, "bun"));

            // eslint-disable-next-line vitest/no-conditional-in-test
            if (name === "findPackageManager") {
                result = await result;
            }

            expect(result).toStrictEqual({
                packageManager: "bun",
                path: join(whichPMFixturePath, "bun"),
            });
        });

        it("should detect npm", async () => {
            expect.assertions(1);

            let result = function_(join(whichPMFixturePath, "npm"));

            // eslint-disable-next-line vitest/no-conditional-in-test
            if (name === "findPackageManager") {
                result = await result;
            }

            expect(result).toStrictEqual({
                packageManager: "npm",
                path: join(whichPMFixturePath, "npm"),
            });
        });

        it("should detect pnpm", async () => {
            expect.assertions(1);

            let result = function_(join(whichPMFixturePath, "pnpm"));

            // eslint-disable-next-line vitest/no-conditional-in-test
            if (name === "findPackageManager") {
                result = await result;
            }

            expect(result).toStrictEqual({
                packageManager: "pnpm",
                path: join(whichPMFixturePath, "pnpm"),
            });
        });

        it("should detect cnpm", async () => {
            expect.assertions(1);

            let result = function_(join(whichPMFixturePath, "cnpm"));

            // eslint-disable-next-line vitest/no-conditional-in-test
            if (name === "findPackageManager") {
                result = await result;
            }

            expect(result).toStrictEqual({
                packageManager: "npm",
                path: join(whichPMFixturePath, "cnpm"),
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

    describe(generateMissingPackagesInstallMessage, () => {
        it("should generate install message with default package managers for single missing package", () => {
            expect.assertions(4);

            const result = generateMissingPackagesInstallMessage("test-package", ["lodash"], {});

            expect(result).toContain("test-package could not find the following package\n\n  lodash");
            expect(result).toContain("npm install lodash@latest --save-dev");
            expect(result).toContain("pnpm add lodash@latest -D");
            expect(result).toContain("yarn add lodash@latest --dev");
        });

        it("should throw error when packageManagers array is empty", () => {
            expect.assertions(1);

            expect(() => {
                generateMissingPackagesInstallMessage("test-package", ["lodash"], {
                    packageManagers: [],
                });
            }).toThrow("No package managers provided, please provide at least one package manager");
        });

        it("should generate install message with default package managers for multiple missing packages", () => {
            expect.assertions(3);

            const packageName = "my-package";
            const missingPackages = ["lodash", "express"];
            const options = {};

            const result = generateMissingPackagesInstallMessage(packageName, missingPackages, options);

            expect(result).toContain("npm install lodash@latest express@latest --save-dev");
            expect(result).toContain("pnpm add lodash@latest express@latest -D");
            expect(result).toContain("yarn add lodash@latest express@latest --dev");
        });

        it("should generate install message with custom package managers list", () => {
            expect.assertions(1);

            const packageName = "my-package";
            const missingPackages = ["lodash"];
            const options = { packageManagers: ["bun"] as PackageManager[] };

            const result = generateMissingPackagesInstallMessage(packageName, missingPackages, options);

            expect(result).toContain("bun add lodash@latest -D");
        });

        it("should generate install message with pre and post messages", () => {
            expect.assertions(3);

            const packageName = "my-package";
            const missingPackages = ["lodash"];
            const options = { postMessage: "Post-message", preMessage: "Pre-message" };

            const result = generateMissingPackagesInstallMessage(packageName, missingPackages, options);

            expect(result).toContain("Pre-message");
            expect(result).toContain("npm install lodash@latest --save-dev");
            expect(result).toContain("Post-message");
        });
    });
});
