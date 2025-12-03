import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { esc, execScriptSync } from "../helpers";

// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = dirname(fileURLToPath(import.meta.url));

describe("usage `@visulima/pail` npm package", () => {
    it.each(["server", "browser"])(`should export correct and working ESM code for pail %s`, async (name: string) => {
        expect.assertions(1);

        const filename = join(__dirname, "../..", `__fixtures__/package/mjs/pail.${name}.mjs`);
        const received = await execScriptSync(filename);

        expect(JSON.parse(esc(received))).toStrictEqual({
            date: expect.any(String),
            groups: [],
            label: "warning",
            message: "esm",
            scope: [],
        });
    });
});
