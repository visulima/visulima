import { fileURLToPath } from "node:url";

import { dirname, join } from "@visulima/path";
import { describe, expect, it } from "vitest";

import readToml from "../../../src/read/read-toml";
import readTomlSync from "../../../src/read/read-toml-sync";

// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
const __dirname = dirname(fileURLToPath(import.meta.url));

const fixturePath = join(__dirname, "..", "..", "..", "__fixtures__", "read-toml");
const ANY_ERROR = /./;

type ReadTomlFunction = (path: URL | string) => Promise<Record<string, unknown>> | Record<string, unknown>;

describe.each([
    ["readToml", readToml as ReadTomlFunction],
    ["readTomlSync", readTomlSync as ReadTomlFunction],
])("%s", (name: string, function_: ReadTomlFunction) => {
    it("should read a .toml file", async () => {
        expect.assertions(3);

        const path = join(fixturePath, "file.toml");
        const content: Promise<Record<string, unknown>> | Record<string, unknown> = function_(path);
        const parsed = (name === "readToml" ? await content : content) as Record<string, unknown>;

        expect(parsed.title).toBe("TOML Example");
        expect(parsed.owner).toStrictEqual({ name: "Tom Preston-Werner" });
        expect(parsed.database).toStrictEqual({ enabled: true, ports: [8000, 8001, 8002] });
    });

    it("should throw on a broken toml file", async () => {
        expect.assertions(1);

        const path = join(fixturePath, "broken.toml");

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "readToml") {
            // eslint-disable-next-line vitest/no-conditional-expect
            await expect(async () => function_(path)).rejects.toThrow(ANY_ERROR);
        } else {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(() => function_(path)).toThrow(ANY_ERROR);
        }
    });
});
