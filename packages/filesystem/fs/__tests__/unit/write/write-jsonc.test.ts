import { readFile, rm, writeFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import writeJsonc from "../../../src/write/write-jsonc";
import writeJsoncSync from "../../../src/write/write-jsonc-sync";

describe.each([
    ["writeJsonc", writeJsonc],
    ["writeJsoncSync", writeJsoncSync],
])("%s", (name, function_) => {
    it("writes a fresh JSONC file as JSON when no existing file is present", async () => {
        expect.assertions(1);

        const path = `test.${name}.fresh.jsonc`;
        const data = { name: "test", version: "1.0.0" };

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeJsonc") {
            await function_(path, data);
        } else {
            function_(path, data);
        }

        const content = await readFile(path, "utf8");

        expect(JSON.parse(content)).toStrictEqual(data);

        await rm(path);
    });

    it("preserves comments and indentation when updating an existing JSONC file", async () => {
        expect.assertions(3);

        const path = `test.${name}.preserve.jsonc`;
        const original = `{
    // header comment
    "name": "original",
    /* block comment */
    "version": "1.0.0",
    "keep": "me"
}
`;

        await writeFile(path, original, "utf8");

        const next = { keep: "me", name: "updated", version: "2.0.0" };

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeJsonc") {
            await function_(path, next);
        } else {
            function_(path, next);
        }

        const updated = await readFile(path, "utf8");

        expect(updated).toContain("// header comment");
        expect(updated).toContain("/* block comment */");
        // eslint-disable-next-line @stylistic/quotes
        expect(updated).toContain('"name": "updated"');

        await rm(path);
    });
});
