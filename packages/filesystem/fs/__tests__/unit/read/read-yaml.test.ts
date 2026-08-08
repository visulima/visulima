import { fileURLToPath } from "node:url";

import { dirname, join } from "@visulima/path";
import { YAMLError } from "@visulima/yaml";
import { describe, expect, it } from "vitest";

import readYaml from "../../../src/read/read-yaml";
import readYamlSync from "../../../src/read/read-yaml-sync";

// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
const __dirname = dirname(fileURLToPath(import.meta.url));

const fixturePath = join(__dirname, "..", "..", "..", "__fixtures__", "read-yaml");

type ReadYamlFunction = (path: URL | string) => Promise<Record<string, unknown>> | Record<string, unknown>;

describe.each([
    ["readYaml", readYaml as ReadYamlFunction],
    ["readYamlSync", readYamlSync as ReadYamlFunction],
])("%s", (name: string, function_: ReadYamlFunction) => {
    it("should read .yaml file", async () => {
        expect.assertions(1);

        const path = join(fixturePath, "file.yaml");

        const content: Promise<Record<string, unknown>> | Record<string, unknown> = function_(path);

        expect(name === "readYaml" ? await content : content).toStrictEqual({
            YAML: ["A human-readable data serialization language", "https://en.wikipedia.org/wiki/YAML"],
            yaml: ["A complete JavaScript implementation", "https://www.npmjs.com/package/yaml"],
        });
    });

    it("should read .yml file", async () => {
        expect.assertions(1);

        const path = join(fixturePath, "file.yml");

        const content: Promise<Record<string, unknown>> | Record<string, unknown> = function_(path);

        expect(name === "readYaml" ? await content : content).toStrictEqual({
            YAML: ["A human-readable data serialization language", "https://en.wikipedia.org/wiki/YAML"],
            yaml: ["A complete JavaScript implementation", "https://www.npmjs.com/package/yaml"],
        });
    });

    it("should throw a error on a broken yaml file", async () => {
        expect.assertions(1);

        const path = join(fixturePath, "broken.yml");

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "readYaml") {
            // eslint-disable-next-line vitest/no-conditional-expect
            await expect(() => function_(path)).rejects.toThrow(YAMLError);
        } else {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(() => function_(path)).toThrow(YAMLError);
        }
    });
});

describe("readYaml parse options", () => {
    const optionsFixture = join(fixturePath, "off.yaml");

    it("accepts parse options in the second argument", async () => {
        expect.assertions(2);

        // The documented `readYaml(path, options)` overload used to be ignored:
        // only the third argument was inspected, so options passed here were
        // silently dropped.
        await expect(readYaml(optionsFixture)).resolves.toStrictEqual({ a: "off" });
        await expect(readYaml(optionsFixture, { schema: "yaml-1.1" })).resolves.toStrictEqual({ a: false });
    });

    it("accepts parse options in the second argument synchronously", () => {
        expect.assertions(2);

        expect(readYamlSync(optionsFixture)).toStrictEqual({ a: "off" });
        expect(readYamlSync(optionsFixture, { schema: "yaml-1.1" })).toStrictEqual({ a: false });
    });
});
