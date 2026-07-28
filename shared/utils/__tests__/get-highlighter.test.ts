import type { LanguageInput } from "shiki";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createHighlighterCore = vi.fn();

vi.mock("shiki/core", () => ({ createHighlighterCore }));
vi.mock("shiki/engine/javascript", () => ({ createJavaScriptRegexEngine: () => ({}) }));

const createFakeHighlighter = () => ({
    dispose: vi.fn(),
    getLoadedLanguages: () => [] as string[],
    loadLanguage: vi.fn(async () => undefined),
});

describe("get-highlighter", () => {
    beforeEach(() => {
        createHighlighterCore.mockReset();
    });

    afterEach(async () => {
        const { disposeHighlighter } = await import("../get-highlighter");

        await disposeHighlighter();
        vi.resetModules();
    });

    it("retries creation after a failed initialization instead of caching the rejection", async () => {
        const { default: getHighlighter } = await import("../get-highlighter");

        const fakeHighlighter = createFakeHighlighter();

        createHighlighterCore.mockRejectedValueOnce(new Error("init failed")).mockResolvedValueOnce(fakeHighlighter);

        await expect(getHighlighter()).rejects.toThrow("init failed");

        const highlighter = await getHighlighter();

        expect(highlighter).toBe(fakeHighlighter);
        expect(createHighlighterCore).toHaveBeenCalledTimes(2);
    });

    it("loads custom LanguageInput grammars directly", async () => {
        const { default: getHighlighter } = await import("../get-highlighter");

        const fakeHighlighter = createFakeHighlighter();

        createHighlighterCore.mockResolvedValue(fakeHighlighter);

        const customGrammar = {
            name: "my-custom-lang",
            patterns: [],
            repository: {},
            scopeName: "source.custom",
        } as unknown as LanguageInput;

        await getHighlighter([customGrammar]);

        expect(fakeHighlighter.loadLanguage).toHaveBeenCalledWith(customGrammar);
    });
});
