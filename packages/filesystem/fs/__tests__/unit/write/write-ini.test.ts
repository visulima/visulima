import { readFile, rm, writeFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import writeIni from "../../../src/write/write-ini";
import writeIniSync from "../../../src/write/write-ini-sync";

describe.each([
    ["writeIni", writeIni],
    ["writeIniSync", writeIniSync],
])("%s", (name, function_) => {
    it("writes a fresh INI file", async () => {
        expect.assertions(2);

        const path = `test.${name}.fresh.ini`;
        const data = { server: { host: "localhost", port: 8080 } };

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeIni") {
            await function_(path, data);
        } else {
            function_(path, data);
        }

        const content = await readFile(path, "utf8");

        expect(content).toContain("[server]");
        expect(content).toContain("port=8080");

        await rm(path);
    });

    it("preserves space-around-= when the existing file uses it", async () => {
        expect.assertions(2);

        const path = `test.${name}.preserve-spaces.ini`;
        const original = "key = value\nother = 1\n";

        await writeFile(path, original, "utf8");

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeIni") {
            await function_(path, { key: "value", other: 2 });
        } else {
            function_(path, { key: "value", other: 2 });
        }

        const updated = await readFile(path, "utf8");

        expect(updated).toContain("key = value");
        expect(updated).toContain("other = 2");

        await rm(path);
    });

    it("preserves CRLF line endings when the existing file uses them", async () => {
        expect.assertions(1);

        const path = `test.${name}.crlf.ini`;
        const original = "key=value\r\nother=1\r\n";

        await writeFile(path, original, "utf8");

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeIni") {
            await function_(path, { key: "value", other: 2 });
        } else {
            function_(path, { key: "value", other: 2 });
        }

        const updated = await readFile(path, "utf8");

        expect(updated).toContain("\r\n");

        await rm(path);
    });

    it("preserves inline comments and trailing whitespace for unchanged keys", async () => {
        expect.assertions(2);

        const path = `test.${name}.preserve-inline.ini`;
        const original = "key=value ; keep this comment\nother=1\n";

        await writeFile(path, original, "utf8");

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeIni") {
            await function_(path, { key: "value", other: 2 });
        } else {
            function_(path, { key: "value", other: 2 });
        }

        const updated = await readFile(path, "utf8");

        expect(updated).toContain("key=value ; keep this comment");
        expect(updated).toContain("other=2");

        await rm(path);
    });
});
