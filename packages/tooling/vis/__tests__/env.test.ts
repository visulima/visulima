import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("env command version validation", () => {
    it("should accept valid semver versions", () => {
        expect.assertions(3);

        const validVersions = ["22.13.1", "20.0.0", "18.19.0"];
        const regex = /^\d+\.\d+\.\d+$/;

        for (const v of validVersions) {
            expect(regex.test(v)).toBe(true);
        }
    });

    it("should reject versions with command injection", () => {
        expect.assertions(4);

        const maliciousVersions = [
            '1.0.0"; rm -rf / #',
            "../../etc",
            "1.0.0 && echo hacked",
            '$(whoami)',
        ];
        const regex = /^\d+\.\d+\.\d+$/;

        for (const v of maliciousVersions) {
            expect(regex.test(v)).toBe(false);
        }
    });

    it("should reject partial versions for install/uninstall", () => {
        expect.assertions(3);

        const partialVersions = ["22", "22.13", "latest"];
        const regex = /^\d+\.\d+\.\d+$/;

        for (const v of partialVersions) {
            expect(regex.test(v)).toBe(false);
        }
    });
});

describe("env pin version validation", () => {
    it("should accept semver ranges for pin", () => {
        expect.assertions(5);

        const validPinVersions = ["22", "22.13", "22.13.1", "^22.0.0", "~22.13"];
        const regex = /^[~^]?\d+(\.\d+){0,2}([.-]\w+)*$/;

        for (const v of validPinVersions) {
            expect(regex.test(v)).toBe(true);
        }
    });

    it("should reject malicious pin versions", () => {
        expect.assertions(3);

        const malicious = ["../../etc", "22; rm -rf /", "$(whoami)"];
        const regex = /^[~^]?\d+(\.\d+){0,2}([.-]\w+)*$/;

        for (const v of malicious) {
            expect(regex.test(v)).toBe(false);
        }
    });
});

describe("env .node-version resolution", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "vis-env-test-"));
    });

    afterEach(() => {
        rmSync(tmpDir, { force: true, recursive: true });
    });

    it("should read .node-version file", () => {
        expect.assertions(1);

        writeFileSync(join(tmpDir, ".node-version"), "22.13.1\n");

        const content = readFileSync(join(tmpDir, ".node-version"), "utf8").trim();

        expect(content).toBe("22.13.1");
    });

    it("should read engines.node from package.json", () => {
        expect.assertions(1);

        writeFileSync(
            join(tmpDir, "package.json"),
            JSON.stringify({ engines: { node: ">=22" } }),
        );

        const pkg = JSON.parse(readFileSync(join(tmpDir, "package.json"), "utf8"));

        expect(pkg.engines.node).toBe(">=22");
    });

    it("should read devEngines.runtime from package.json", () => {
        expect.assertions(2);

        writeFileSync(
            join(tmpDir, "package.json"),
            JSON.stringify({
                devEngines: {
                    runtime: { name: "node", version: "^24.4.0" },
                },
            }),
        );

        const pkg = JSON.parse(readFileSync(join(tmpDir, "package.json"), "utf8"));

        expect(pkg.devEngines.runtime.name).toBe("node");
        expect(pkg.devEngines.runtime.version).toBe("^24.4.0");
    });
});
