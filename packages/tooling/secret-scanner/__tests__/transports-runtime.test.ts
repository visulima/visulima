import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { extractUri, resetWarningsForTests, tryImport, warnMissingDep } from "../src/transports/runtime";

afterEach(() => {
    resetWarningsForTests();
});

describe(extractUri, () => {
    it("returns the trimmed secret when it already starts with `<scheme>://`", () => {
        expect.assertions(2);

        expect(extractUri("  mongodb://user:pw@host/db  ", "mongodb")).toBe("mongodb://user:pw@host/db");
        expect(extractUri("postgres://u:p@h:5432/d", "postgres")).toBe("postgres://u:p@h:5432/d");
    });

    it("accepts the `<scheme>+srv` variant as a direct prefix match", () => {
        expect.assertions(1);

        expect(extractUri("mongodb+srv://u:p@host.example.com/db", "mongodb")).toBe("mongodb+srv://u:p@host.example.com/db");
    });

    it("extracts an embedded URI from surrounding noise", () => {
        expect.assertions(1);

        const noise = 'const url = "mysql://root:secret@db.internal:3306/app"; // staging';

        expect(extractUri(noise, "mysql")).toBe('mysql://root:secret@db.internal:3306/app";');
    });

    it("returns undefined when the scheme isn't in the input", () => {
        expect.assertions(1);

        expect(extractUri("postgres://not-mysql/db", "mysql")).toBeUndefined();
    });
});

describe(tryImport, () => {
    it("resolves to undefined and emits a one-time warning when the package isn't installed", async () => {
        expect.assertions(2);

        const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const result = await tryImport("@this-package-definitely-does-not-exist/anywhere", "TestTransport");

        expect(result).toBeUndefined();
        expect(consoleError.mock.calls.length).toBeGreaterThan(0);

        consoleError.mockRestore();
    });

    it("resolves an installed peer dep (built-in module) successfully", async () => {
        expect.assertions(1);

        // `node:path` always resolves; using it confirms the success path without
        // depending on an actual peer dep being installed in the workspace.
        const mod = await tryImport<{ join: (...parts: string[]) => string }>("node:path", "TestTransport");

        expect(mod?.join).toBeTypeOf("function");
    });

    it("rethrows errors that aren't 'module not found' (genuine bugs surface loudly)", async () => {
        expect.assertions(1);

        // A module that resolves fine but throws during evaluation has no
        // MODULE_NOT_FOUND code and doesn't match the message pattern, so
        // `tryImport` must rethrow rather than swallow it as "missing dep".
        const dir = await mkdtemp(resolve(tmpdir(), "secret-scanner-runtime-"));
        const broken = resolve(dir, "broken.cjs");

        await writeFile(broken, "throw new Error('boom from broken peer dep');\n");

        try {
            await expect(tryImport(broken, "TestTransport")).rejects.toThrow("boom from broken peer dep");
        } finally {
            await rm(dir, { force: true, recursive: true });
        }
    });
});

describe(warnMissingDep, () => {
    it("writes one message per (type, package) pair per process", () => {
        expect.assertions(2);

        const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

        warnMissingDep("MongoDB", "mongodb");
        warnMissingDep("MongoDB", "mongodb");
        warnMissingDep("MongoDB", "mongodb");

        expect(consoleError).toHaveBeenCalledTimes(1);

        // A different type for the same package still warns once (different cache key).
        warnMissingDep("AtlasAdmin", "mongodb");

        expect(consoleError).toHaveBeenCalledTimes(2);

        consoleError.mockRestore();
    });
});
