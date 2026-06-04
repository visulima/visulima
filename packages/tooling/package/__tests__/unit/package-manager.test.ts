import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { platform, tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { dirname, join } from "@visulima/path";
import { x } from "tinyexec";
import { afterEach, describe, expect, it, vi } from "vitest";

import package_ from "../../package.json";
import type { PackageManager } from "../../src/package-manager";
import {
    findPackageManager,
    findPackageManagerSync,
    generateMissingPackagesInstallMessage,
    getPackageManagerVersion,
    identifyInitiatingPackageManager,
} from "../../src/package-manager";

const whichPMFixturePath = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "__fixtures__", "which-package-manager");

// eslint-disable-next-line vitest/prefer-import-in-mock
vi.mock("node:child_process", () => {
    return {
        execFileSync: (file: string, arguments_: string[]) => {
            if (file === "npm" && arguments_[0] === "--version") {
                return "7.0.15";
            }

            if (file === "yarn" && arguments_[0] === "--version") {
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

    describe.each([
        ["findPackageManager", findPackageManager],
        ["findPackageManagerSync", findPackageManagerSync],
    ])("%s edge cases", (name, function_) => {
        let temporaryDirectory: string;

        afterEach(() => {
            rmSync(temporaryDirectory, { force: true, recursive: true });
        });

        it("should throw when package.json declares an unknown packageManager", async () => {
            expect.assertions(1);

            temporaryDirectory = mkdtempSync(join(tmpdir(), "visulima-package-"));

            writeFileSync(join(temporaryDirectory, "package.json"), JSON.stringify({ name: "root", packageManager: "deno@1.0.0", version: "1.0.0" }));

            // eslint-disable-next-line vitest/no-conditional-in-test
            if (name === "findPackageManager") {
                // eslint-disable-next-line vitest/no-conditional-expect
                await expect((function_ as typeof findPackageManager)(temporaryDirectory)).rejects.toThrow("Could not find a package manager");
            } else {
                // eslint-disable-next-line vitest/no-conditional-expect
                expect(() => (function_ as typeof findPackageManagerSync)(temporaryDirectory)).toThrow("Could not find a package manager");
            }
        });
    });

    describe(identifyInitiatingPackageManager, () => {
        const originalUserAgent = process.env.npm_config_user_agent;

        afterEach(() => {
            if (originalUserAgent === undefined) {
                delete process.env.npm_config_user_agent;
            } else {
                process.env.npm_config_user_agent = originalUserAgent;
            }
        });

        it("should return undefined when npm_config_user_agent is not set", () => {
            expect.assertions(1);

            delete process.env.npm_config_user_agent;

            expect(identifyInitiatingPackageManager()).toBeUndefined();
        });

        it("should parse the package manager name and version from npm_config_user_agent", () => {
            expect.assertions(1);

            process.env.npm_config_user_agent = "pnpm/8.6.0 npm/? node/v20.0.0 linux x64";

            expect(identifyInitiatingPackageManager()).toStrictEqual({ name: "pnpm", version: "8.6.0" });
        });

        it("should map npminstall to cnpm", () => {
            expect.assertions(1);

            process.env.npm_config_user_agent = "npminstall/5.0.0 node/v20.0.0";

            expect(identifyInitiatingPackageManager()).toStrictEqual({ name: "cnpm", version: "5.0.0" });
        });
    });

    describe("identifyInitiatingPackageManager (live)", () => {
        it.skipIf(platform() === "win32" || package_.devDependencies.bun === undefined)("should detect bun", async () => {
            expect.assertions(1);

            const { stdout } = await x("bun", ["install"], { nodeOptions: { cwd: join(whichPMFixturePath, "bun") } });

            expect(stdout).toBeDefined();
        });

        it.skipIf(platform() === "win32")(
            "should detect npm",
            async () => {
                expect.assertions(1);

                const { stdout } = await x("npm", ["install"], { nodeOptions: { cwd: join(whichPMFixturePath, "npm") } });

                expect(stdout).toBeDefined();
            },
            60_000,
        );

        it.skipIf(platform() === "win32")(
            "should detect pnpm",
            async () => {
                expect.assertions(1);

                const { stdout } = await x("pnpm", ["install"], { nodeOptions: { cwd: join(whichPMFixturePath, "pnpm") } });

                expect(stdout).toBeDefined();
            },
            60_000,
        );
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

        it("should throw error when no missing packages are provided", () => {
            expect.assertions(1);

            expect(() => {
                generateMissingPackagesInstallMessage("test-package", [], {});
            }).toThrow("No missing packages provided, please provide at least one missing package");
        });

        it("should throw error for an unknown package manager", () => {
            expect.assertions(1);

            expect(() => {
                generateMissingPackagesInstallMessage("test-package", ["lodash"], {
                    packageManagers: ["deno" as never],
                });
            }).toThrow("Unknown package manager");
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
