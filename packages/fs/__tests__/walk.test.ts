import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { walk } from "../src";

describe("walk", () => {
    it("should find folders and files", async () => {
        expect.assertions(1);

        const files: string[] = [];

        // eslint-disable-next-line no-restricted-syntax,no-loops/no-loops
        for await (const index of walk(`${__dirname}/../__fixtures__`, {})) {
            files.push(index.path);
        }

        expect(files).toStrictEqual([
            join(__dirname, "..", "/__fixtures__"),
            join(__dirname, "..", "/__fixtures__", "/test.js"),
            join(__dirname, "..", "/__fixtures__", "/test.json"),
            join(__dirname, "..", "/__fixtures__", "/test2.ts"),
        ]);
    });
});
