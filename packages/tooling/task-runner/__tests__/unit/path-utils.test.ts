import { delimiter, sep } from "node:path";

import { describe, expect, it } from "vitest";

import { buildEnhancedPath, collectNodeModulesBinDirs, withEnhancedPath } from "../../src/path-utils";

describe(collectNodeModulesBinDirs, () => {
    it("returns the cwd's `.bin` first, then each parent's `.bin`", () => {
        expect.assertions(4);

        const dirs = collectNodeModulesBinDirs(`${sep}home${sep}user${sep}project${sep}packages${sep}foo`);

        expect(dirs[0]).toBe(`${sep}home${sep}user${sep}project${sep}packages${sep}foo${sep}node_modules${sep}.bin`);
        expect(dirs[1]).toBe(`${sep}home${sep}user${sep}project${sep}packages${sep}node_modules${sep}.bin`);
        expect(dirs[2]).toBe(`${sep}home${sep}user${sep}project${sep}node_modules${sep}.bin`);
        // Eventually walks up to the root entry.
        expect(dirs).toContain(`${sep}node_modules${sep}.bin`);
    });

    it("stops walking at the filesystem root", () => {
        expect.assertions(2);

        const dirs = collectNodeModulesBinDirs(sep);

        expect(dirs).toHaveLength(1);
        expect(dirs[0]).toBe(`${sep}node_modules${sep}.bin`);
    });

    it("resolves relative cwd against process.cwd()", () => {
        expect.assertions(1);

        const dirs = collectNodeModulesBinDirs(".");

        // First entry resolves to process.cwd()/node_modules/.bin.
        expect(dirs[0]).toBe(`${process.cwd()}${sep}node_modules${sep}.bin`);
    });
});

describe(buildEnhancedPath, () => {
    it("prepends `.bin` dirs to the supplied env's PATH", () => {
        expect.assertions(2);

        const cwd = `${sep}repo${sep}pkg`;
        // Join the caller PATH with the platform `delimiter` (`;` on Windows,
        // `:` elsewhere) so the round-trip through `split(delimiter)` below is
        // platform-consistent — a hard-coded `:` would stay one token on Windows.
        const result = buildEnhancedPath(cwd, { PATH: ["/usr/bin", "/bin"].join(delimiter) });

        const parts = result.split(delimiter);

        expect(parts[0]).toBe(`${sep}repo${sep}pkg${sep}node_modules${sep}.bin`);
        // Caller-supplied PATH remains at the end.
        expect(parts.at(-1)).toBe("/bin");
    });

    it("falls back to process.env PATH when none is supplied", () => {
        expect.assertions(1);

        const previous = process.env["PATH"];

        process.env["PATH"] = "/process/path";

        try {
            const result = buildEnhancedPath(`${sep}repo`);
            const parts = result.split(delimiter);

            expect(parts.at(-1)).toBe("/process/path");
        } finally {
            process.env["PATH"] = previous;
        }
    });

    it("honours the Windows `Path` alias when `PATH` is absent", () => {
        expect.assertions(1);

        const result = buildEnhancedPath(`${sep}repo`, { Path: String.raw`C:\Windows` });

        expect(result.endsWith(String.raw`C:\Windows`)).toBe(true);
    });

    it("returns just the bin chain when no existing PATH is set", () => {
        expect.assertions(2);

        const previous = process.env["PATH"];
        const previousAlias = process.env["Path"];

        delete process.env["PATH"];
        delete process.env["Path"];

        try {
            const result = buildEnhancedPath(`${sep}repo`, {});

            expect(result).toContain(`${sep}repo${sep}node_modules${sep}.bin`);
            expect(result.startsWith(delimiter)).toBe(false);
        } finally {
            if (previous !== undefined) {
                process.env["PATH"] = previous;
            }

            if (previousAlias !== undefined) {
                process.env["Path"] = previousAlias;
            }
        }
    });
});

describe(withEnhancedPath, () => {
    it("returns a new env object without mutating the input", () => {
        expect.assertions(4);

        const input: NodeJS.ProcessEnv = { FOO: "bar", PATH: "/usr/bin" };
        const output = withEnhancedPath(input, `${sep}repo`);

        expect(output).not.toBe(input);
        expect(input.PATH).toBe("/usr/bin");
        expect(output.PATH).toMatch(/repo[\\/]node_modules[\\/]\.bin/u);
        expect(output.FOO).toBe("bar");
    });

    it("mirrors the rewritten value into the Windows `Path` alias", () => {
        expect.assertions(1);

        const output = withEnhancedPath({ PATH: "/a", Path: "/a" }, `${sep}repo`);

        expect(output.Path).toBe(output.PATH);
    });

    it("does not introduce a `Path` alias when one was not present", () => {
        expect.assertions(1);

        const output = withEnhancedPath({ PATH: "/a" }, `${sep}repo`);

        expect("Path" in output).toBe(false);
    });
});
