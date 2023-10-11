import path from "node:path";

import { describe, expect, it } from "vitest";

import { walk } from "../src";

describe("walk", () => {
    it("should find folders and files", async () => {
        const files: string[] = [];

        // eslint-disable-next-line no-restricted-syntax,no-loops/no-loops
        for await (const index of walk(`${__dirname}/../__fixtures__`, {})) {
            files.push(index.path);
        }

        expect(files).toStrictEqual([
            path.join(__dirname, "..", "/__fixtures__"),

            path.join(__dirname, "..", "/__fixtures__", "/test.js"),

            path.join(__dirname, "..", "/__fixtures__", "/test2.ts"),
        ]);
    });
});
