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
        expect.assertions(2);

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

        const { isDisposableEmail } = await import("../src/index");

        // With an empty built-in list, even a known disposable domain resolves to false,
        // while custom domains still work.
        expect(isDisposableEmail("user@10minutemail.com")).toBe(false);
        expect(isDisposableEmail("user@custom.com", new Set(["custom.com"]))).toBe(true);
    });

    it("falls back to an empty list when domains.json is not an array", async () => {
        expect.assertions(2);

        vi.resetModules();
        vi.doMock(import("node:fs"), async (importOriginal) => {
            const actual = await importOriginal<typeof import("node:fs")>();

            return {
                ...actual,
                readFileSync: () => JSON.stringify({ not: "an array" }),
            };
        });

        const { isDisposableEmail } = await import("../src/index");

        expect(isDisposableEmail("user@10minutemail.com")).toBe(false);
        expect(isDisposableEmail("user@custom.com", new Set(["custom.com"]))).toBe(true);
    });

    it("uses the parsed array when domains.json is valid", async () => {
        expect.assertions(2);

        vi.resetModules();
        vi.doMock(import("node:fs"), async (importOriginal) => {
            const actual = await importOriginal<typeof import("node:fs")>();

            return {
                ...actual,
                readFileSync: () => JSON.stringify(["mocked-disposable.com"]),
            };
        });

        const { isDisposableEmail } = await import("../src/index");

        expect(isDisposableEmail("user@mocked-disposable.com")).toBe(true);
        expect(isDisposableEmail("user@10minutemail.com")).toBe(false);
    });
});
