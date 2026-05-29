import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import type { MockInstance } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import listCommand from "../../../../../src/framework/cli/command/list/list-command";

const packageRoot = resolve(__dirname, "../../../../../");
const pagesExample = "__fixtures__/collect/pages-example";

describe("framework/cli/command/list/list-command", () => {
    let logSpy: MockInstance<(...arguments_: unknown[]) => void>;

    beforeEach(() => {
        logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should throw when the provided path does not exist", async () => {
        expect.assertions(1);

        vi.spyOn(process, "cwd").mockReturnValue(packageRoot);

        await expect(listCommand("next", "does/not/exist")).rejects.toThrow("No such file, invalid path provided.");
    });

    it("should throw when no package.json can be found up the tree", async () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "api-platform-list-"));

        mkdirSync(join(temporaryDirectory, "pages/api"), { recursive: true });
        writeFileSync(join(temporaryDirectory, "pages/api/hello.ts"), "export default () => {};", "utf8");

        vi.spyOn(process, "cwd").mockReturnValue(temporaryDirectory);

        try {
            await expect(listCommand("next", ".")).rejects.toThrow("Please initialize local package.json.");
        } finally {
            rmSync(temporaryDirectory, { force: true, recursive: true });
        }
    });

    it("should throw when the framework cannot be auto-detected", async () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "api-platform-list-"));

        writeFileSync(join(temporaryDirectory, "package.json"), JSON.stringify({ dependencies: {}, name: "fixture" }), "utf8");
        writeFileSync(join(temporaryDirectory, "app.ts"), "export default {};", "utf8");

        vi.spyOn(process, "cwd").mockReturnValue(temporaryDirectory);

        try {
            await expect(listCommand(undefined, "app.ts")).rejects.toThrow("Couldn't detect supported back-end framework.");
        } finally {
            rmSync(temporaryDirectory, { force: true, recursive: true });
        }
    });

    it("should throw when a directory is given for a non-next framework", async () => {
        expect.assertions(1);

        vi.spyOn(process, "cwd").mockReturnValue(packageRoot);

        await expect(listCommand("express", pagesExample)).rejects.toThrow("is directory, but file expected.");
    });

    it("should throw for an unsupported application file extension", async () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "api-platform-list-"));

        writeFileSync(join(temporaryDirectory, "package.json"), JSON.stringify({ dependencies: { express: "5" }, name: "fixture" }), "utf8");
        writeFileSync(join(temporaryDirectory, "app.txt"), "module.exports = {};", "utf8");

        vi.spyOn(process, "cwd").mockReturnValue(temporaryDirectory);

        try {
            await expect(listCommand("express", "app.txt")).rejects.toThrow("Please specify application .ts/.js/.mjs/.cjs file.");
        } finally {
            rmSync(temporaryDirectory, { force: true, recursive: true });
        }
    });

    it("should list next routes and print the summary", async () => {
        expect.assertions(1);

        vi.spyOn(process, "cwd").mockReturnValue(packageRoot);

        await listCommand("next", pagesExample);

        const printedSummary = logSpy.mock.calls.some((call) => String(call[0]).includes("HTTP route"));

        expect(printedSummary).toBe(true);
    });

    it("should group next routes when the group option is provided", async () => {
        expect.assertions(1);

        vi.spyOn(process, "cwd").mockReturnValue(packageRoot);

        await listCommand("next", pagesExample, { group: "path" });

        expect(logSpy).toHaveBeenCalledWith();
    });

    it("should filter routes with includePaths and excludePaths", async () => {
        expect.assertions(1);

        vi.spyOn(process, "cwd").mockReturnValue(packageRoot);

        await listCommand("next", pagesExample, {
            excludePaths: ["/pages/api/jsdefaultroute"],
            includePaths: ["/pages/api"],
        });

        const printedSummary = logSpy.mock.calls.some((call) => String(call[0]).includes("HTTP route"));

        expect(printedSummary).toBe(true);
    });
});
