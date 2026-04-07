import { fileURLToPath } from "node:url";

import { dirname, join } from "@visulima/path";
import { describe, expect, it } from "vitest";
import { YAMLError } from "yaml";

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
