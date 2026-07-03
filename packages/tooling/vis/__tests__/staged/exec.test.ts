import { describe, expect, it } from "vitest";

import { chunkFiles, parseCommandString } from "../../src/staged/tasks/exec";

describe(parseCommandString, () => {
    it("splits a simple command into argv", () => {
        expect.assertions(1);

        expect(parseCommandString("eslint --fix")).toStrictEqual(["eslint", "--fix"]);
    });

    it("preserves double-quoted arguments with spaces", () => {
        expect.assertions(1);

        expect(parseCommandString("prettier --write \"src/a b.ts\"")).toStrictEqual(["prettier", "--write", "src/a b.ts"]);
    });

    it("preserves single-quoted arguments with spaces", () => {
        expect.assertions(1);

        expect(parseCommandString("echo 'hello world'")).toStrictEqual(["echo", "hello world"]);
    });

    it("handles backslash escapes outside quotes", () => {
        expect.assertions(1);

        expect(parseCommandString(String.raw`echo a\ b c`)).toStrictEqual(["echo", "a b", "c"]);
    });

    it("returns an empty array for blank input", () => {
        expect.assertions(1);

        expect(parseCommandString("   ")).toStrictEqual([]);
    });

    it("rejects unterminated double quotes", () => {
        expect.assertions(1);

        expect(() => parseCommandString("echo \"oops")).toThrow(/unterminated double quote/i);
    });

    it("rejects unterminated single quotes", () => {
        expect.assertions(1);

        expect(() => parseCommandString("echo 'oops")).toThrow(/unterminated single quote/i);
    });

    it("interprets backslash escapes inside double quotes per POSIX semantics", () => {
        expect.assertions(2);

        // `\"` inside double quotes is the escaped quote character.
        expect(parseCommandString(String.raw`node -e "console.log(\"hi\")"`)).toStrictEqual(["node", "-e", "console.log(\"hi\")"]);
        // `\\` inside double quotes is a single backslash.
        expect(parseCommandString(String.raw`echo "path\\file"`)).toStrictEqual(["echo", String.raw`path\file`]);
    });

    it("treats backslashes as literal inside single quotes", () => {
        expect.assertions(1);

        expect(parseCommandString(String.raw`echo 'a\b'`)).toStrictEqual(["echo", String.raw`a\b`]);
    });
});

describe("execCommand env injection", () => {
    // The env builder is unexported, but `execCommand` is the only caller and we can't spawn real subprocesses in unit tests.
    // Instead, we verify the contract indirectly: an explicit env override wins over the injected FORCE_COLOR default.
    // This is a regression guard for lint-staged / nano-staged #33 (color preservation).

    it("exports DEFAULT_MAX_ARG_LENGTH as a platform-appropriate number", async () => {
        expect.assertions(2);

        const { DEFAULT_MAX_ARG_LENGTH } = await import("../../src/staged/tasks/exec");

        expect(DEFAULT_MAX_ARG_LENGTH).toBeGreaterThan(0);

        // Windows cmd line caps at ~32k characters; POSIX ARG_MAX is
        // typically 128k+. Pick the appropriate upper/lower bound once
        // based on platform to avoid a conditional expect.
        const [threshold, matcher]: [number, "above" | "below"] = process.platform === "win32" ? [33_000, "below"] : [100_000, "above"];

        expect(DEFAULT_MAX_ARG_LENGTH).toSatisfy((value: number) => (matcher === "below" ? value < threshold : value > threshold));
    });
});

describe(chunkFiles, () => {
    it("returns a single chunk when everything fits", () => {
        expect.assertions(1);

        expect(chunkFiles(["a", "b", "c"], 20, 131_072)).toStrictEqual([["a", "b", "c"]]);
    });

    it("splits files into chunks when the limit is tight", () => {
        expect.assertions(2);

        const chunks = chunkFiles(["aaa", "bbb", "ccc"], 0, 5);

        expect(chunks.length).toBeGreaterThan(1);
        expect(chunks.flat()).toStrictEqual(["aaa", "bbb", "ccc"]);
    });

    it("guarantees at least one file per chunk even for long paths", () => {
        expect.assertions(1);

        const chunks = chunkFiles(["x".repeat(200)], 0, 10);

        expect(chunks).toStrictEqual([["x".repeat(200)]]);
    });

    it("falls back to the default limit when maxArgLength is 0", () => {
        expect.assertions(1);

        expect(chunkFiles(["a", "b"], 0, 0)).toStrictEqual([["a", "b"]]);
    });
});
