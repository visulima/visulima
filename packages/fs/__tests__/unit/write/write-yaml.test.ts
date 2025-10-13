import { readFile, rm } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import writeYaml from "../../../src/write/write-yaml";
import writeYamlSync from "../../../src/write/write-yaml-sync";

describe.each([
    ["writeYaml", writeYaml],
    ["writeYamlSync", writeYamlSync],
])("%s", (name, function_) => {
    it("should write a yaml file", async () => {
        expect.assertions(1);

        const path = "test.yaml";
        const data = { test: "test" };

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeYaml") {
            await function_(path, data);
        } else {
            function_(path, data);
        }

        const content = await readFile(path, "utf8");

        expect(content).toBe("test: test\n");

        await rm(path);
    });

    it("should write a yaml file with options", async () => {
        expect.assertions(1);

        const path = "test.yaml";
        const data = { test: { deep: "test" } };
        const options = { indent: 4 };

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeYaml") {
            await function_(path, data, options);
        } else {
            function_(path, data, options);
        }

        const content = await readFile(path, "utf8");

        expect(content).toBe("test:\n    deep: test\n");

        await rm(path);
    });

    it("should write a yaml file with replacer", async () => {
        expect.assertions(1);

        const path = "test.yaml";
        const data = { test: { deep: "test" } };

        const replacer = (key: string, value: any) => (key === "test" ? "replaced" : value);

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeYaml") {
            await function_(path, data, replacer);
        } else {
            function_(path, data, replacer);
        }

        const content = await readFile(path, "utf8");

        expect(content).toBe("test: replaced\n");

        await rm(path);
    });

    it("should write a yaml file with replacer and options", async () => {
        expect.assertions(1);

        const path = "test.yaml";
        const data = { test: { deep: "test" } };

        const replacer = (key: string, value: any) => (key === "deep" ? "replaced" : value);
        const options = { indent: 4 };

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeYaml") {
            await function_(path, data, replacer, options);
        } else {
            function_(path, data, replacer, options);
        }

        const content = await readFile(path, "utf8");

        expect(content).toBe("test:\n    deep: replaced\n");

        await rm(path);
    });
});
