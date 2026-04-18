import { readFile, rm } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import writeJson5 from "../../../src/write/write-json5";
import writeJson5Sync from "../../../src/write/write-json5-sync";

describe.each([
    ["writeJson5", writeJson5],
    ["writeJson5Sync", writeJson5Sync],
])("%s", (name, function_) => {
    it("writes a JSON5 file with single quotes by default", async () => {
        expect.assertions(2);

        const path = `test.${name}.json5`;
        const data = { features: ["a", "b"], name: "test" };

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeJson5") {
            await function_(path, data, { indent: 2 });
        } else {
            function_(path, data, { indent: 2 });
        }

        const content = await readFile(path, "utf8");

        expect(content).toContain("name:");
        expect(content.endsWith("\n")).toBe(true);

        await rm(path);
    });

    it("writes a JSON5 file with a custom quote character", async () => {
        expect.assertions(1);

        const path = `test.${name}.quoted.json5`;
        const data = { name: "test" };

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeJson5") {
            await function_(path, data, { indent: 2, quote: "'" });
        } else {
            function_(path, data, { indent: 2, quote: "'" });
        }

        const content = await readFile(path, "utf8");

        expect(content).toContain("'test'");

        await rm(path);
    });
});
