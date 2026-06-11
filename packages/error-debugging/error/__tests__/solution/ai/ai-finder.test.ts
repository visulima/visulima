import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { MockLanguageModelV3 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import aiFinder from "../../../src/solution/ai/ai-finder";
import type { SolutionFinderFile } from "../../../src/solution/types";

const FIX_TEXT = [
    "FIX",
    "Use the named import instead of the default import.",
    "ENDFIX",
    "LINKS",
    "{\"title\": \"Docs\", \"url\": \"https://example.com\"}",
    "ENDLINKS",
].join("\n");

const createModel = (text: string): MockLanguageModelV3 =>
    new MockLanguageModelV3({
        doGenerate: () =>
            Promise.resolve({
                content: text ? [{ text, type: "text" as const }] : [],
                finishReason: "stop" as const,
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                warnings: [],
            }),
    });

const createThrowingModel = (): MockLanguageModelV3 =>
    new MockLanguageModelV3({
        doGenerate: () => Promise.reject(new Error("model failure")),
    });

const file: SolutionFinderFile = {
    file: "src/index.ts",
    language: "typescript",
    line: 10,
    snippet: "10 | import foo from \"./foo\";",
};

describe("solution/ai/ai-finder", () => {
    let cacheDirectory: string;

    beforeEach(() => {
        cacheDirectory = mkdtempSync(join(tmpdir(), "visulima-error-ai-finder-"));
    });

    afterEach(() => {
        rmSync(cacheDirectory, { force: true, recursive: true });
        vi.restoreAllMocks();
    });

    it("exposes the AI SDK finder metadata", () => {
        expect.assertions(2);

        const finder = aiFinder(createModel(FIX_TEXT));

        expect(finder.name).toBe("AI SDK");
        expect(finder.priority).toBe(99);
    });

    it("returns a formatted solution from the model response", async () => {
        expect.assertions(2);

        const finder = aiFinder(createModel(FIX_TEXT), { cache: { directory: cacheDirectory } });
        const solution = await finder.handle(new Error("boom"), file);

        expect(solution?.header).toBe("## Ai Generated Solution");
        expect(solution?.body).toContain("named import");
    });

    it("writes a cache entry and reads it back on the next call", async () => {
        expect.assertions(3);

        const model = createModel(FIX_TEXT);
        const generateSpy = vi.spyOn(model, "doGenerate");

        const finder = aiFinder(model, { cache: { directory: cacheDirectory } });
        const error = new Error("boom");

        const first = await finder.handle(error, file);

        expect(readdirSync(cacheDirectory).some((name) => name.endsWith(".json"))).toBe(true);

        const second = await finder.handle(error, file);

        expect(second).toStrictEqual(first);
        expect(generateSpy).toHaveBeenCalledTimes(1);
    });

    it("does not write a cache entry when caching is disabled", async () => {
        expect.assertions(2);

        const model = createModel(FIX_TEXT);
        const generateSpy = vi.spyOn(model, "doGenerate");

        const finder = aiFinder(model, { cache: { directory: cacheDirectory, enabled: false } });
        const error = new Error("boom");

        await finder.handle(error, file);
        await finder.handle(error, file);

        expect(readdirSync(cacheDirectory)).toHaveLength(0);
        expect(generateSpy).toHaveBeenCalledTimes(2);
    });

    it("ignores an expired cache entry", async () => {
        expect.assertions(1);

        const model = createModel(FIX_TEXT);
        const generateSpy = vi.spyOn(model, "doGenerate");

        const finder = aiFinder(model, { cache: { directory: cacheDirectory, ttl: 1 } });
        const error = new Error("boom");

        await finder.handle(error, file);

        await new Promise((resolve) => {
            setTimeout(resolve, 5);
        });

        await finder.handle(error, file);

        expect(generateSpy).toHaveBeenCalledTimes(2);
    });

    it("returns undefined without caching when the model returns no text", async () => {
        expect.assertions(2);

        const finder = aiFinder(createModel(""), { cache: { directory: cacheDirectory } });
        const solution = await finder.handle(new Error("boom"), file);

        expect(solution).toBeUndefined();
        // A soft failure must not be persisted (so it is not served for the full TTL).
        expect(readdirSync(cacheDirectory)).toHaveLength(0);
    });

    it("returns undefined and logs without caching when generation throws", async () => {
        expect.assertions(3);

        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        const finder = aiFinder(createThrowingModel(), { cache: { directory: cacheDirectory } });
        const solution = await finder.handle(new Error("boom"), file);

        expect(solution).toBeUndefined();
        expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
        // A transient API failure must not poison the cache.
        expect(readdirSync(cacheDirectory)).toHaveLength(0);
    });

    it("uses a corrupted cache file as a cache miss and regenerates", async () => {
        expect.assertions(1);

        const model = createModel(FIX_TEXT);
        const generateSpy = vi.spyOn(model, "doGenerate");

        const error = new Error("boom");
        const finder = aiFinder(model, { cache: { directory: cacheDirectory } });

        await finder.handle(error, file);

        const cacheFile = readdirSync(cacheDirectory).find((name) => name.endsWith(".json"));

        writeFileSync(join(cacheDirectory, cacheFile as string), "not-json", "utf8");

        await finder.handle(error, file);

        expect(generateSpy).toHaveBeenCalledTimes(2);
    });

    it("creates the cache directory when it does not yet exist", async () => {
        expect.assertions(1);

        const nestedDirectory = join(cacheDirectory, "nested", "cache");

        const finder = aiFinder(createModel(FIX_TEXT), { cache: { directory: nestedDirectory } });

        await finder.handle(new Error("boom"), file);

        expect(existsSync(nestedDirectory)).toBe(true);
    });
});
