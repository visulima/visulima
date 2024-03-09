import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import readFile from "../../src/read-file";
import readdirSync from "../../src/read-file-sync";

// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
const __dirname = dirname(fileURLToPath(import.meta.url));

const fixturePath = join(__dirname, "..", "..", "__fixtures__", "read-file");

const isWindows = process.platform === "win32";

describe.each([
    ["readFile", readFile],
    ["readFileSync", readdirSync],
])(`%s`, (name: string, function_) => {
    it("read", async () => {
        expect.assertions(1);

        let result = await function_(join(fixturePath, "text.md"));

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "readFile") {
            result = await result;
        }

        expect(result).toBe(`hello world!${isWindows ? "\r\n" : "\n"}`);
    });

    it("read buffer", async () => {
        expect.assertions(1);

        let result = await function_(join(fixturePath, "text.md"), { buffer: true });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "readFile") {
            result = await result;
        }

        expect(result?.toString()).toBe(`hello world!${isWindows ? "\r\n" : "\n"}`);
    });

    it("read empty", async () => {
        expect.assertions(1);

        let result = await function_(join(fixturePath, "missing.txt"));

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "readFile") {
            result = await result;
        }

        expect(result).toBeUndefined();
    });

    it("read no access", async () => {
        expect.assertions(1);

        let result = await function_("/no-access/b");

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "readFile") {
            result = await result;
        }

        expect(result).toBeUndefined();
    });

    it("read gzip", async () => {
        expect.assertions(1);

        let result = await function_(join(fixturePath, "text.md.gz"), { compression: "gzip" });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "readFile") {
            result = await result;
        }

        expect(result).toBe("hello world!");
    });

    it("read brotli", async () => {
        expect.assertions(1);

        let result = await function_(join(fixturePath, "note.md.br"), { compression: "brotli" });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "readFile") {
            result = await result;
        }

        expect(result).toBe("hello world!");
    });

    it("read invalid", async () => {
        expect.assertions(1);

        let result = await function_("/compressed/note.md.gz", { compression: "brotli" });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "readFile") {
            result = await result;
        }

        expect(result).toBeUndefined();
    });
});
