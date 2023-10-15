import { describe, expect, it, vi } from "vitest";

import { getPackageManagerVersion } from "../src/package-manager";

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

describe("package-manager", () => {
    describe("getPackageManagerVersion", () => {
        it("should return the package manager version", () => {
            expect(getPackageManagerVersion("npm")).toBe("7.0.15");
            expect(getPackageManagerVersion("yarn")).toBe("1.22.10");
        });
    });
});
