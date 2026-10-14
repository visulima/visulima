import { afterEach, describe, expect, it, vi } from "vitest";

// These tests exercise the lazy `dist/domains.json` loader inside `src/index.ts`.
// Because the loaded list is cached at module scope, each scenario imports a fresh
// module instance via `vi.resetModules()` + dynamic `import()` after stubbing the
// `node:fs` builtin the loader resolves through `process.getBuiltinModule`.

const mockReadFileSync = (readFileSync: () => string): void => {
    const getBuiltinModule = process.getBuiltinModule.bind(process);
    const mocked = (id: string): unknown => {
        const actual = getBuiltinModule(id);

        return id === "node:fs" ? { ...actual, readFileSync } : actual;
    };

    vi.spyOn(process, "getBuiltinModule").mockImplementation(mocked as typeof process.getBuiltinModule);
};

describe("domains.json loading", () => {
    afterEach(() => {
        vi.resetModules();
        vi.restoreAllMocks();
    });

    it("falls back to an empty list when reading domains.json throws", async () => {
        expect.assertions(3);

        vi.resetModules();
        mockReadFileSync(() => {
            throw new Error("ENOENT: no such file");
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
        mockReadFileSync(() => JSON.stringify({ not: "an array" }));

        const { isFreeEmail, isListLoaded } = await import("../src/index");

        expect(isFreeEmail("user@gmail.com")).toBe(false);
        expect(isFreeEmail("user@custom.com", new Set(["custom.com"]))).toBe(true);
        // A corrupt (non-array) file is a degraded state, observable via isListLoaded().
        expect(isListLoaded()).toBe(false);
    });

    it("uses the parsed array when domains.json is valid", async () => {
        expect.assertions(2);

        vi.resetModules();
        mockReadFileSync(() => JSON.stringify(["mocked-free.com"]));

        const { isFreeEmail } = await import("../src/index");

        expect(isFreeEmail("user@mocked-free.com")).toBe(true);
        expect(isFreeEmail("user@gmail.com")).toBe(false);
    });

    it("assertListLoaded throws when the built-in list cannot be read", async () => {
        expect.assertions(2);

        vi.resetModules();
        mockReadFileSync(() => {
            throw new Error("ENOENT: no such file");
        });

        const { assertListLoaded } = await import("../src/index");

        expect(assertListLoaded).toThrow("[@visulima/free-email-domains] The built-in list is not loaded");
        expect(assertListLoaded).toThrow("setDomains()");
    });

    it("assertListLoaded passes once setDomains() has supplied a list", async () => {
        expect.assertions(1);

        vi.resetModules();
        mockReadFileSync(() => {
            throw new Error("ENOENT: no such file");
        });

        const { assertListLoaded, setDomains } = await import("../src/index");

        setDomains(["injected-free.example"]);

        expect(assertListLoaded).not.toThrow();
    });

    it("assertListLoaded loads the list from disk and passes when it is readable", async () => {
        expect.assertions(2);

        vi.resetModules();
        mockReadFileSync(() => JSON.stringify(["mocked-free.example"]));

        const { assertListLoaded, isListLoaded } = await import("../src/index");

        expect(assertListLoaded).not.toThrow();
        expect(isListLoaded()).toBe(true);
    });
});
