import { fileURLToPath } from "node:url";

import { dirname, join } from "@visulima/path";
import { describe, expect, it } from "vitest";

import readIni from "../../../src/read/read-ini";
import readIniSync from "../../../src/read/read-ini-sync";

// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
const __dirname = dirname(fileURLToPath(import.meta.url));

const fixturePath = join(__dirname, "..", "..", "..", "__fixtures__", "read-ini");

type ReadIniFunction = (path: URL | string) => Promise<Record<string, unknown>> | Record<string, unknown>;

describe.each([
    ["readIni", readIni as ReadIniFunction],
    ["readIniSync", readIniSync as ReadIniFunction],
])("%s", (name: string, function_: ReadIniFunction) => {
    it("should read an .ini file into a nested object", async () => {
        expect.assertions(3);

        const path = join(fixturePath, "file.ini");
        const content = function_(path);
        const parsed = (name === "readIni" ? await content : content) as Record<string, Record<string, unknown>>;

        expect(parsed.name).toBe("ini-example");
        expect({ ...parsed.server }).toStrictEqual({ host: "localhost", port: "8080" });
        expect({ ...parsed.database }).toStrictEqual({ enabled: true, url: "postgres://localhost" });
    });
});
