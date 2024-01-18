import { platform } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { execa } from "execa";
import { describe, expect, it, vi } from "vitest";

import package_ from "../package.json";
import { getPackageManagerVersion } from "../src/package-manager";

const whichPMFixturePath = join(dirname(fileURLToPath(import.meta.url)), "..", "__fixtures__", "which-package-manager");

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
    describe("getPackageManagerVersion", () => {
        it("should return the package manager version", () => {
            expect.assertions(2);

            expect(getPackageManagerVersion("npm")).toBe("7.0.15");
            expect(getPackageManagerVersion("yarn")).toBe("1.22.10");
        });
    });

    describe("whichPackageManagerRuns", () => {
        it("detects yarn", () => {
            expect.assertions(1);

            expect(async () => await execa("yarn", [], { cwd: join(whichPMFixturePath, "yarn") })).not.toThrow();
        });

        // eslint-disable-next-line vitest/no-done-callback
        it("should detect bun", async (context) => {
            expect.assertions(1);

            // eslint-disable-next-line vitest/no-conditional-in-test,vitest/no-conditional-tests
            if (platform() === "win32" || package_.devDependencies.bun === undefined) {
                // eslint-disable-next-line no-console
                console.info("bun is not supported on windows");
                context.skip();
            }

            expect(async () => await execa("bun", ["install"], { cwd: join(whichPMFixturePath, "bun") })).not.toThrow();
        });

        it("should detect npm", () => {
            expect.assertions(1);

            expect(async () => await execa("npm", ["install"], { cwd: join(whichPMFixturePath, "npm") })).not.toThrow();
        });

        it("should detect pnpm", () => {
            expect.assertions(1);

            expect(async () => await execa("pnpm", ["install"], { cwd: join(whichPMFixturePath, "pnpm") })).not.toThrow();
        });

        it("should detect cnpm", () => {
            expect.assertions(1);

            expect(async () => await execa("cnpm", ["install"], { cwd: join(whichPMFixturePath, "cnpm") })).not.toThrow();
        });
    });
});
