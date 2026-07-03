import { readFile, rm } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import writeToml from "../../../src/write/write-toml";
import writeTomlSync from "../../../src/write/write-toml-sync";

describe.each([
    ["writeToml", writeToml],
    ["writeTomlSync", writeTomlSync],
])("%s", (name, function_) => {
    it("should write a toml file", async () => {
        expect.assertions(1);

        const path = `test.${name}.toml`;
        const data = { owner: { name: "John" }, title: "test" };

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeToml") {
            await function_(path, data);
        } else {
            function_(path, data);
        }

        const content = await readFile(path, "utf8");

        // eslint-disable-next-line @stylistic/quotes
        expect(content).toContain('title = "test"');

        await rm(path);
    });
});
