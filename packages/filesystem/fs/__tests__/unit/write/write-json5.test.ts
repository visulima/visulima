import { readFile, rm, writeFile } from "node:fs/promises";

import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import writeJson5 from "../../../src/write/write-json5";
import writeJson5Sync from "../../../src/write/write-json5-sync";

const FAILED_WRITE_RE = /Failed to write file/;

describe.each([
    ["writeJson5", writeJson5],
    ["writeJson5Sync", writeJson5Sync],
])("%s", (name, function_) => {
    let distribution: string;

    beforeEach(() => {
        distribution = temporaryDirectory();
    });

    afterEach(async () => {
        await rm(distribution, { force: true, recursive: true });
    });

    it("writes a JSON5 file with single quotes by default", async () => {
        expect.assertions(2);

        const path = `${distribution}/test.${name}.json5`;
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
    });

    it("writes a JSON5 file with a custom quote character", async () => {
        expect.assertions(1);

        const path = `${distribution}/test.${name}.quoted.json5`;
        const data = { name: "test" };

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeJson5") {
            await function_(path, data, { indent: 2, quote: "'" });
        } else {
            function_(path, data, { indent: 2, quote: "'" });
        }

        const content = await readFile(path, "utf8");

        expect(content).toContain("'test'");
    });

    it("detects indent from an existing file when detectIndent is true", async () => {
        expect.assertions(2);

        const path = `${distribution}/test.${name}.detect-indent.json5`;

        // Existing file uses 4-space indent
        await writeFile(path, "{\n    foo: 1,\n}\n", "utf8");

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeJson5") {
            await function_(path, { foo: 2 }, { detectIndent: true });
        } else {
            function_(path, { foo: 2 }, { detectIndent: true });
        }

        const content = await readFile(path, "utf8");

        // Detected indent should be 4 spaces
        expect(content).toContain("    foo:");
        expect(content.endsWith("\n")).toBe(true);
    });

    it("respects the indent option when detectIndent is true but no indent detected", async () => {
        expect.assertions(1);

        const path = `${distribution}/test.${name}.flat.json5`;

        // Existing file is a single-line object — no indent to detect
        await writeFile(path, "{foo:1}", "utf8");

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeJson5") {
            await function_(path, { foo: 2 }, { detectIndent: true, indent: 2 });
        } else {
            function_(path, { foo: 2 }, { detectIndent: true, indent: 2 });
        }

        const content = await readFile(path, "utf8");

        expect(content).toContain("  foo:");
    });

    it("preserves the absence of a trailing newline when existing file has none", async () => {
        expect.assertions(1);

        const path = `${distribution}/test.${name}.no-newline.json5`;

        await writeFile(path, "{foo:1}", "utf8");

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeJson5") {
            await function_(path, { foo: 2 }, { indent: 2 });
        } else {
            function_(path, { foo: 2 }, { indent: 2 });
        }

        const content = await readFile(path, "utf8");

        expect(content.endsWith("\n")).toBe(false);
    });

    it("applies the replacer function when serializing", async () => {
        expect.assertions(2);

        const path = `${distribution}/test.${name}.replacer.json5`;
        const data = { kept: "yes", secret: "redact me" };

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeJson5") {
            await function_(path, data, {
                indent: 2,
                replacer: (key: string, value: unknown) => (key === "secret" ? undefined : value),
            });
        } else {
            function_(path, data, {
                indent: 2,
                replacer: (key: string, value: unknown) => (key === "secret" ? undefined : value),
            });
        }

        const content = await readFile(path, "utf8");

        expect(content).toContain("kept:");
        expect(content).not.toContain("secret:");
    });

    it("propagates errors when writing fails", async () => {
        expect.hasAssertions();

        // Pointing at a path whose parent is a regular file forces a write error
        const file = `${distribution}/not-a-dir`;

        await writeFile(file, "block");

        const path = `${file}/child.json5`;

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeJson5") {
            // eslint-disable-next-line vitest/no-conditional-expect
            await expect(function_(path, { foo: 1 })).rejects.toThrow(FAILED_WRITE_RE);
        } else {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(() => function_(path, { foo: 1 })).toThrow(FAILED_WRITE_RE);
        }
    });
});
