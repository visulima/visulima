import { describe, expect, it, vi } from "vitest";
import execa from "execa";
import { platform } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getPackageManagerVersion, identifyInitiatingPackageManager } from "../src/package-manager";

const whichPMFixturePath = join(dirname(fileURLToPath(import.meta.url)), "..", "__fixtures__", "which-package-manager");
console.log(whichPMFixturePath);
vi.mock("node:child_process", () => {
    return {
        execSync: (command: string) => {
            if (command === "npm --version") {
                return "7.0.15";
            } else if (command === "yarn --version") {
                return "1.22.10";
            }
        },
    };
});

delete process.env.npm_config_user_agent;

describe("package-manager", () => {
    describe("getPackageManagerVersion", () => {
        it("should return the package manager version", () => {
            expect(getPackageManagerVersion("npm")).toBe("7.0.15");
            expect(getPackageManagerVersion("yarn")).toBe("1.22.10");
        });
    });

    describe("whichPackageManagerRuns", () => {
        it("detects yarn", () => {
            expect(() => execa("yarn", [], { cwd: join(whichPMFixturePath, "yarn") })).not.toThrow();
        });

        it("should detect bun", (context) => {
            if (platform() === "win32") {
                console.info("bun is not supported on windows");
                context.skip();
            }

            expect(() => execa("bun", ["install"], { cwd: join(whichPMFixturePath, "bun") })).not.toThrow();
        });

        it("should detect npm", () => {
            expect(() => execa("npm", ["install"], { cwd: join(whichPMFixturePath, "npm") })).not.toThrow();
        });

        it("should detect pnpm", () => {
            expect(() => execa("pnpm", ["install"], { cwd: join(whichPMFixturePath, "pnpm") })).not.toThrow();
        });

        it("should detect cnpm", () => {
            expect(() => execa("cnpm", ["install"], { cwd: join(whichPMFixturePath, "cnpm") })).not.toThrow();
        });
    });
});
