import {
    describe, expect, it,
} from "vitest";

import { walk } from "../src";

describe("walk", () => {
    it("should find folders and files", async () => {
        const files: string[] = [];

        // eslint-disable-next-line no-restricted-syntax, unicorn/prefer-module
        for await (const index of walk(`${__dirname}/fixtures`, {})) {
            files.push(index.path);
        }

        expect(files).toEqual([
            // eslint-disable-next-line unicorn/prefer-module
            `${__dirname}/fixtures`,
            // eslint-disable-next-line unicorn/prefer-module
            `${__dirname}/fixtures/test.js`,
            // eslint-disable-next-line unicorn/prefer-module
            `${__dirname}/fixtures/test2.ts`,
        ]);
    });
});
