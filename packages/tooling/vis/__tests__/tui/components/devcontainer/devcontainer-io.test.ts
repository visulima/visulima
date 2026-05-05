import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readDevcontainerJson, writeDevcontainerJson } from "../../../../src/tui/components/devcontainer/devcontainer-io";

describe("devcontainer-io", () => {
    let tempDir: string;

    beforeEach(() => {
        // eslint-disable-next-line sonarjs/pseudo-random -- temp-dir suffix in tests, not security-sensitive
        tempDir = join(tmpdir(), `vis-dc-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
        mkdirSync(tempDir, { recursive: true });
    });

    afterEach(() => {
        rmSync(tempDir, { force: true, recursive: true });
    });

    describe(readDevcontainerJson, () => {
        it("should return null when file does not exist", () => {
            expect.assertions(1);

            expect(readDevcontainerJson(tempDir)).toBeNull();
        });

        it("should read a valid devcontainer.json", () => {
            expect.assertions(3);

            const dcDir = join(tempDir, ".devcontainer");

            mkdirSync(dcDir, { recursive: true });
            writeFileSync(
                join(dcDir, "devcontainer.json"),
                JSON.stringify({
                    image: "ubuntu",
                    name: "Test",
                }),
            );

            const result = readDevcontainerJson(tempDir);

            expect(result).not.toBeNull();
            expect(result?.config.name).toBe("Test");
            expect(result?.hadComments).toBe(false);
        });

        it("should detect JSONC comments", () => {
            expect.assertions(2);

            const dcDir = join(tempDir, ".devcontainer");

            mkdirSync(dcDir, { recursive: true });
            writeFileSync(
                join(dcDir, "devcontainer.json"),
                `{
    // This is a comment
    "name": "Test",
    "image": "ubuntu"
}`,
            );

            const result = readDevcontainerJson(tempDir);

            expect(result).not.toBeNull();
            expect(result?.hadComments).toBe(true);
        });

        it("should throw on invalid JSON", () => {
            expect.assertions(1);

            const dcDir = join(tempDir, ".devcontainer");

            mkdirSync(dcDir, { recursive: true });
            writeFileSync(join(dcDir, "devcontainer.json"), "{ invalid json }");

            expect(() => readDevcontainerJson(tempDir)).toThrow(/Failed to parse/u);
        });
    });

    describe(writeDevcontainerJson, () => {
        it("should create .devcontainer directory and write file", () => {
            expect.assertions(2);

            writeDevcontainerJson(tempDir, { image: "ubuntu", name: "Test" });

            const filePath = join(tempDir, ".devcontainer", "devcontainer.json");

            expect(existsSync(filePath)).toBe(true);

            const content = JSON.parse(readFileSync(filePath, "utf8"));

            expect(content.name).toBe("Test");
        });

        it("should write to custom output path", () => {
            expect.assertions(1);

            const customPath = join(tempDir, "custom", "devcontainer.json");

            writeDevcontainerJson(tempDir, { image: "ubuntu", name: "Custom" }, customPath);

            expect(existsSync(customPath)).toBe(true);
        });

        it("should produce pretty-printed JSON with trailing newline", () => {
            expect.assertions(2);

            writeDevcontainerJson(tempDir, { image: "ubuntu", name: "Test" });

            const raw = readFileSync(join(tempDir, ".devcontainer", "devcontainer.json"), "utf8");

            expect(raw).toContain("\n  ");
            expect(raw.endsWith("\n")).toBe(true);
        });

        it("should roundtrip with readDevcontainerJson", () => {
            expect.assertions(2);

            const config = {
                features: { "ghcr.io/devcontainers/features/node:1": {} },
                forwardPorts: [3000],
                image: "mcr.microsoft.com/devcontainers/javascript-node:22",
                name: "Roundtrip Test",
            };

            writeDevcontainerJson(tempDir, config);
            const result = readDevcontainerJson(tempDir);

            expect(result).not.toBeNull();
            expect(result?.config).toStrictEqual(config);
        });
    });
});
