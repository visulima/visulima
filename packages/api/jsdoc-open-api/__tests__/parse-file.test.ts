import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Block } from "comment-parser";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { OpenApiObject } from "../src/exported";
import parseFile, { parseFileMulti } from "../src/parse-file";

const noopCommentsToOpenApi = (): { loc: number; spec: OpenApiObject }[] => [];

describe(parseFile, () => {
    let workDirectory: string;

    beforeEach(() => {
        workDirectory = mkdtempSync(join(tmpdir(), "parse-file-"));
    });

    afterEach(() => {
        rmSync(workDirectory, { force: true, recursive: true });
    });

    it("returns a spec with line count for a YAML file with allowed keys", () => {
        expect.assertions(1);

        const file = join(workDirectory, "spec.yaml");

        writeFileSync(file, "openapi: 3.0.0\ninfo:\n  title: API\n  version: 1.0.0\npaths: {}\n");

        const result = parseFile(file, noopCommentsToOpenApi);

        expect(result).toStrictEqual([
            {
                loc: expect.any(Number),
                spec: { info: { title: "API", version: "1.0.0" }, openapi: "3.0.0", paths: {} },
            },
        ]);
    });

    it("throws a ParseError carrying filePath when a YAML file has unexpected keys", () => {
        expect.assertions(2);

        const file = join(workDirectory, "bad.yaml");

        writeFileSync(file, "openapi: 3.0.0\nunexpected: true\nanother: false\n");

        let caught: (Error & { filePath?: string }) | undefined;

        try {
            parseFile(file, noopCommentsToOpenApi);
        } catch (error) {
            caught = error as Error & { filePath?: string };
        }

        expect(caught?.message).toBe("Unexpected keys: unexpected, another");
        expect(caught?.filePath).toBe(file);
    });

    it("returns an empty array for a YAML file that parses to an empty mapping", () => {
        expect.assertions(1);

        const file = join(workDirectory, "empty.yml");

        // An empty flow mapping has no keys: no invalid keys and no allowed keys,
        // so the parser short-circuits to an empty result.
        writeFileSync(file, "{}\n");

        expect(parseFile(file, noopCommentsToOpenApi)).toStrictEqual([]);
    });

    it("delegates non-YAML files to the comment parser and rethrows with filePath on failure", () => {
        expect.assertions(2);

        const file = join(workDirectory, "broken.js");

        writeFileSync(file, "// some js source\n");

        const failingParser = (): { loc: number; spec: OpenApiObject }[] => {
            throw new Error("parser blew up");
        };

        let caught: (Error & { filePath?: string }) | undefined;

        try {
            parseFile(file, failingParser);
        } catch (error) {
            caught = error as Error & { filePath?: string };
        }

        expect(caught?.message).toBe("parser blew up");
        expect(caught?.filePath).toBe(file);
    });

    it("returns the comment parser result for non-YAML files when parsing succeeds", () => {
        expect.assertions(1);

        const file = join(workDirectory, "ok.js");

        writeFileSync(file, "// some js source\n");

        const parser = (): { loc: number; spec: OpenApiObject }[] => [
            { loc: 3, spec: { info: { title: "x", version: "1" }, openapi: "3.0.0" } },
        ];

        expect(parseFile(file, parser)).toStrictEqual([{ loc: 3, spec: { info: { title: "x", version: "1" }, openapi: "3.0.0" } }]);
    });
});

describe(parseFileMulti, () => {
    let workDirectory: string;

    beforeEach(() => {
        workDirectory = mkdtempSync(join(tmpdir(), "parse-file-multi-"));
    });

    afterEach(() => {
        rmSync(workDirectory, { force: true, recursive: true });
    });

    it("reads the file once and shares parsed comments with every translator", () => {
        expect.assertions(3);

        const file = join(workDirectory, "ok.js");

        writeFileSync(file, "/**\n * GET /\n */\n");

        const received: (Block[] | undefined)[] = [];

        const makeTranslator = (loc: number) => (_content: string, _verbose?: boolean, comments?: Block[]): { loc: number; spec: OpenApiObject }[] => {
            received.push(comments);

            return [{ loc, spec: { paths: {} } as OpenApiObject }];
        };

        const result = parseFileMulti(file, [makeTranslator(1), makeTranslator(2)]);

        expect(result).toStrictEqual([
            { loc: 1, spec: { paths: {} } },
            { loc: 2, spec: { paths: {} } },
        ]);
        // Both translators get the same parsed-comment array instance.
        expect(received[0]).toBe(received[1]);
        expect(Array.isArray(received[0])).toBe(true);
    });

    it("handles YAML files without running the comment translators", () => {
        expect.assertions(1);

        const file = join(workDirectory, "spec.yaml");

        writeFileSync(file, "openapi: 3.0.0\ninfo:\n  title: API\n  version: 1.0.0\npaths: {}\n");

        const throwingTranslator = (): { loc: number; spec: OpenApiObject }[] => {
            throw new Error("should not be called for YAML");
        };

        expect(parseFileMulti(file, [throwingTranslator])).toStrictEqual([
            {
                loc: expect.any(Number),
                spec: { info: { title: "API", version: "1.0.0" }, openapi: "3.0.0", paths: {} },
            },
        ]);
    });

    it("rethrows translator errors with the offending file path attached", () => {
        expect.assertions(2);

        const file = join(workDirectory, "broken.js");

        writeFileSync(file, "// js\n");

        const failingTranslator = (): { loc: number; spec: OpenApiObject }[] => {
            throw new Error("boom");
        };

        let caught: (Error & { filePath?: string }) | undefined;

        try {
            parseFileMulti(file, [failingTranslator]);
        } catch (error) {
            caught = error as Error & { filePath?: string };
        }

        expect(caught?.message).toBe("boom");
        expect(caught?.filePath).toBe(file);
    });
});
