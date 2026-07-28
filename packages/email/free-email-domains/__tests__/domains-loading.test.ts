import { afterEach, describe, expect, it, vi } from "vitest";

// These tests exercise the lazy `dist/domains.json` loader inside `src/index.ts`.
// Because the loaded list is cached at module scope, each scenario imports a fresh
// module instance via `vi.resetModules()` + dynamic `import()` after configuring the
// `node:fs` mock.

describe("domains.json loading", () => {
    afterEach(() => {
        vi.resetModules();
        vi.doUnmock("node:fs");
        vi.restoreAllMocks();
    });

    it("falls back to an empty list when reading domains.json throws", async () => {
        expect.assertions(3);

        vi.resetModules();
        vi.doMock(import("node:fs"), async (importOriginal) => {
            const actual = await importOriginal<typeof import("node:fs")>();

            return {
                ...actual,
                readFileSync: () => {
                    throw new Error("ENOENT: no such file");
                },
            };
        });

        const { isFreeEmail, isListLoaded } = await import("../src/index");

        // With an empty built-in list, even a known free provider resolves to false,
        // while custom domains still work.
        expect(isFreeEmail("user@gmail.com")).toBe(false);
        expect(isFreeEmail("user@custom.com", new Set(["custom.com"]))).toBe(true);
        // The degraded state is observable via isListLoaded().
        expect(isListLoaded()).toBe(false);
    });

    it("falls back to an empty list when domains.json is not an array", async () => {
        expect.assertions(3);

        vi.resetModules();
        vi.doMock(import("node:fs"), async (importOriginal) => {
            const actual = await importOriginal<typeof import("node:fs")>();

            return {
                ...actual,
                readFileSync: () => JSON.stringify({ not: "an array" }),
            };
        });

        const { isFreeEmail, isListLoaded } = await import("../src/index");

        expect(isFreeEmail("user@gmail.com")).toBe(false);
        expect(isFreeEmail("user@custom.com", new Set(["custom.com"]))).toBe(true);
        // A corrupt (non-array) file is a degraded state, observable via isListLoaded().
        expect(isListLoaded()).toBe(false);
    });

    it("uses the parsed array when domains.json is valid", async () => {
        expect.assertions(2);

        vi.resetModules();
        vi.doMock(import("node:fs"), async (importOriginal) => {
            const actual = await importOriginal<typeof import("node:fs")>();

            return {
                ...actual,
                readFileSync: () => JSON.stringify(["mocked-free.com"]),
            };
        });

        const { isFreeEmail } = await import("../src/index");

        expect(isFreeEmail("user@mocked-free.com")).toBe(true);
        expect(isFreeEmail("user@gmail.com")).toBe(false);
    });
});
