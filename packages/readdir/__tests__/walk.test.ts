import {
    describe, expect, it,
} from "vitest";
import path from "path";

import { walk } from "../src";

describe("walk", () => {
    it("should find folders and files", async () => {
        const files: string[] = [];

        // eslint-disable-next-line no-restricted-syntax, unicorn/prefer-module
        for await (const index of walk(`${__dirname}/../__fixtures__`, {})) {
            files.push(index.path);
        }

        expect(files).toEqual([
            // eslint-disable-next-line unicorn/prefer-module
            path.join(__dirname, '..', '/__fixtures__'),
            // eslint-disable-next-line unicorn/prefer-module
            path.join(__dirname, '..', '/__fixtures__', '/test.js'),
            // eslint-disable-next-line unicorn/prefer-module
            path.join(__dirname, '..', '/__fixtures__', '/test2.ts'),
        ]);
    });
});
