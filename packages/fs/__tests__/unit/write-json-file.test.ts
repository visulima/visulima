import { readFileSync, writeFileSync } from "node:fs";

import { temporaryFile } from "tempy";
import { describe, expect, it } from "vitest";

import writeJson from "../../src/write-json";
import writeJsonSync from "../../src/write-json-sync";

describe.each([
    ["writeJson", writeJson],
    ["writeJsonSync", writeJsonSync],
])("%s", (name, function_) => {
    it("should write a json file", async () => {
        expect.assertions(1);

        const path = temporaryFile({ extension: "json" });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeJson") {
            await function_(path, { foo: true }, { indent: 2 });
        } else {
            function_(path, { foo: true }, { indent: 2 });
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(readFileSync(path, "utf8")).toBe('{\n  "foo": true\n}\n');
    });

    it("should detect file indent", async () => {
        expect.assertions(1);

        const path = temporaryFile({ extension: "json" });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeJson") {
            await function_(path, { foo: true }, { indent: 2 });
            await function_(path, { bar: true, foo: true, foobar: true }, { detectIndent: true });
        } else {
            function_(path, { foo: true }, { indent: 2 });
            function_(path, { bar: true, foo: true, foobar: true }, { detectIndent: true });
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(readFileSync(path, "utf8")).toBe('{\n  "bar": true,\n  "foo": true,\n  "foobar": true\n}\n');
    });

    it("fall back to default indent if file doesn't exist", async () => {
        expect.assertions(1);

        const path = temporaryFile({ extension: "json" });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeJson") {
            await function_(path, { bar: true, foo: true, foobar: true }, { detectIndent: true });
        } else {
            function_(path, { bar: true, foo: true, foobar: true }, { detectIndent: true });
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(readFileSync(path, "utf8")).toBe('{\n\t"bar": true,\n\t"foo": true,\n\t"foobar": true\n}\n');
    });

    it("should handle the `replacer` option", async () => {
        expect.assertions(1);

        const path = temporaryFile({ extension: "json" });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeJson") {
            await function_(path, { bar: true, foo: true }, { replacer: ["foo"] });
        } else {
            function_(path, { bar: true, foo: true }, { replacer: ["foo"] });
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(readFileSync(path, "utf8")).toBe('{\n\t"foo": true\n}\n');
    });

    it("should respect trailing newline at the end of the file", async () => {
        expect.assertions(1);

        const path = temporaryFile({ extension: "json" });

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        writeFileSync(path, JSON.stringify({ foo: true }));

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeJson") {
            await function_(path, { bar: true });
        } else {
            function_(path, { bar: true });
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(readFileSync(path, "utf8")).toBe('{\n\t"bar": true\n}');
    });

    it("should handle the `indent` option to be undefined", async () => {
        expect.assertions(1);

        const path = temporaryFile({ extension: "json" });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeJson") {
            await function_(path, { foo: true }, { indent: undefined });
        } else {
            function_(path, { foo: true }, { indent: undefined });
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(readFileSync(path, "utf8")).toBe('{"foo":true}\n');
    });
});
