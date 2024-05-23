import { fileURLToPath } from "node:url";

import { dirname, join } from "@visulima/path";
import { describe, expect, it } from "vitest";
import { YAMLError } from "yaml";

import readYaml from "../../../src/read/read-yaml";
import readYamlSync from "../../../src/read/read-yaml-sync";

// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
const __dirname = dirname(fileURLToPath(import.meta.url));

const fixturePath = join(__dirname, "..", "..", "..", "__fixtures__", "read-yaml");

describe.each([
    ["readYaml", readYaml],
    ["readYamlSync", readYamlSync],
])("%s", (name, function_) => {
    it("should read .yaml file", async () => {
        expect.assertions(1);

        const path = join(fixturePath, "file.yaml");

        const content: string = name === "readYaml" ? ((await function_(path)) as string) : (function_(path) as string);

        expect(content).toStrictEqual({
            YAML: ["A human-readable data serialization language", "https://en.wikipedia.org/wiki/YAML"],
            yaml: ["A complete JavaScript implementation", "https://www.npmjs.com/package/yaml"],
        });
    });

    it("should read .yml file", async () => {
        expect.assertions(1);

        const path = join(fixturePath, "file.yml");

        const content: string = name === "readYaml" ? ((await function_(path)) as string) : (function_(path) as string);

        expect(content).toStrictEqual({
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
