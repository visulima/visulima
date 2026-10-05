import { describe, expect, it, vi } from "vitest";

import { Files } from "../../src/files";
import MemoryStorage from "../../src/storage/memory/memory-storage";
import { ERRORS } from "../../src/utils/errors";

const keys = ["photos/cover.jpg", "photos/2024/spain/beach.jpg", "photos/2024/notes.txt", "photos/.hidden.jpg", "docs/Report.PDF", "docs/report.pdf", "a.jpg"];

const createFiles = (prefix?: string): Files => {
    const initial = Object.fromEntries(keys.map((key) => [prefix ? `${prefix}/${key}` : key, key]));

    return new Files({ adapter: new MemoryStorage({ initial }), ...(prefix && { prefix }) });
};

const search = async (files: Files, ...arguments_: Parameters<Files["search"]>): Promise<string[]> => {
    const found = await Array.fromAsync(files.search(...arguments_));

    return found.map(({ key }) => key).toSorted();
};

describe("files.search", () => {
    it("should match globs against the whole key", async () => {
        expect.assertions(5);

        const files = createFiles();

        await expect(search(files, "photos/*.jpg")).resolves.toStrictEqual(["photos/.hidden.jpg", "photos/cover.jpg"]);
        await expect(search(files, "photos/**/*.jpg")).resolves.toStrictEqual(["photos/.hidden.jpg", "photos/2024/spain/beach.jpg", "photos/cover.jpg"]);
        await expect(search(files, "docs/report.???")).resolves.toStrictEqual(["docs/report.pdf"]);
        await expect(search(files, "[a-b].jpg")).resolves.toStrictEqual(["a.jpg"]);
        // No wildcard: an exact match, not a substring.
        await expect(search(files, "cover.jpg")).resolves.toStrictEqual([]);
    });

    it("should support regex, substring, exact and case-insensitive matching", async () => {
        expect.assertions(5);

        const files = createFiles();

        await expect(search(files, String.raw`\.txt$`, { match: "regex" })).resolves.toStrictEqual(["photos/2024/notes.txt"]);
        await expect(search(files, /^docs\/.*\.pdf$/u)).resolves.toStrictEqual(["docs/report.pdf"]);
        await expect(search(files, "spain", { match: "substring" })).resolves.toStrictEqual(["photos/2024/spain/beach.jpg"]);
        await expect(search(files, "a.jpg", { match: "exact" })).resolves.toStrictEqual(["a.jpg"]);
        await expect(search(files, "docs/*.pdf", { caseInsensitive: true })).resolves.toStrictEqual(["docs/Report.PDF", "docs/report.pdf"]);
    });

    it("should match keys without the constructor prefix", async () => {
        expect.assertions(1);

        await expect(search(createFiles("tenant"), "docs/*.pdf")).resolves.toStrictEqual(["docs/report.pdf"]);
    });

    it("should push a glob's literal head down as the walk prefix, unless matching ignores case", async () => {
        expect.assertions(3);

        const files = createFiles();
        const listAll = vi.spyOn(files, "listAll");

        await search(files, "photos/2024/*.txt");
        await search(files, "**/*.jpg", { prefix: "photos/" });
        await search(files, "photos/*.jpg", { caseInsensitive: true });

        expect(listAll.mock.calls[0]?.[0]).toMatchObject({ prefix: "photos/2024/" });
        expect(listAll.mock.calls[1]?.[0]).toMatchObject({ prefix: "photos/" });
        expect(listAll.mock.calls[2]?.[0]).not.toHaveProperty("prefix");
    });

    it("should stop after limit matches and honour an aborted signal", async () => {
        expect.assertions(2);

        const files = createFiles();

        await expect(search(files, "**", { limit: 2 })).resolves.toHaveLength(2);
        await expect(search(files, "**", { signal: AbortSignal.abort() })).rejects.toThrow();
    });

    it("should reject an invalid or backtracking-prone regex and an invalid limit", async () => {
        expect.assertions(4);

        const files = createFiles();
        const badRequest = expect.objectContaining({ UploadErrorCode: ERRORS.BAD_REQUEST });

        await expect(search(files, "(", { match: "regex" })).rejects.toThrow(badRequest);
        await expect(search(files, "(a+)+$", { match: "regex" })).rejects.toThrow(badRequest);
        // The backtracking-prone shape under test, as a pattern string rather than a regex literal.
        await expect(search(files, String.raw`(\w*)*x`, { match: "regex" })).rejects.toThrow(badRequest);
        await expect(search(files, "*", { limit: 0 })).rejects.toThrow(badRequest);
    });
});
