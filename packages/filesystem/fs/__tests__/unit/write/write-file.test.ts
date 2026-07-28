import { readFileSync, statSync } from "node:fs";
import { readFile, rm, writeFile as nodeWriteFile } from "node:fs/promises";

import { join } from "@visulima/path";
import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { F_OK } from "../../../src/constants";
import isAccessible from "../../../src/is-accessible";
import isAccessibleSync from "../../../src/is-accessible-sync";
import type { WriteFileOptions } from "../../../src/types";
import writeFile from "../../../src/write/write-file";
import writeFileSync from "../../../src/write/write-file-sync";

const assertWriteFile = async (path: URL | string, content: string, options?: WriteFileOptions) => {
    await writeFile(path, content, options);

    // Assert that the file exists at the specified path
    const fileExists = await isAccessible(path, F_OK);

    expect(fileExists).toBe(true);

    // Assert that the file content matches the expected content

    const fileContent = await readFile(path, "utf8");

    expect(fileContent).toBe(content);
};

const assertWriteFileSync = (path: URL | string, content: string, options?: WriteFileOptions) => {
    writeFileSync(path, content, options);

    // Assert that the file exists at the specified path
    const fileExists = isAccessibleSync(path, F_OK);

    expect(fileExists).toBe(true);

    // Assert that the file content matches the expected content

    const fileContent = readFileSync(path, "utf8");

    expect(fileContent).toBe(content);
};

describe.each(["writeFile", "writeFileSync"])("%s", (name) => {
    let distribution: string;

    beforeEach(async () => {
        distribution = temporaryDirectory();
    });

    afterEach(async () => {
        await rm(distribution, { recursive: true });
    });

    it("should set default options if not provided", async () => {
        expect.assertions(2);

        const path = join(distribution, "file.txt");
        const content = "Hello, World!";

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeFile") {
            await assertWriteFile(path, content);
        } else {
            assertWriteFileSync(path, content);
        }
    });

    it("should write file content to specified path", async () => {
        expect.assertions(2);

        const path = join(distribution, "file.txt");
        const content = "Hello, World!";
        const options: WriteFileOptions = {
            overwrite: true,
            recursive: true,
        };

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeFile") {
            await assertWriteFile(path, content, options);
        } else {
            assertWriteFileSync(path, content, options);
        }
    });

    it("should overwrite existing file if overwrite option is true", async () => {
        expect.assertions(2);

        const path = join(distribution, "file.txt");
        const initialContent = "Initial Content";
        const newContent = "New Content";
        const options: WriteFileOptions = {
            overwrite: true,
            recursive: true,
        };

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeFile") {
            // Create a file with initial content
            await writeFile(path, initialContent, options);

            await assertWriteFile(path, newContent, options);
        } else {
            // Create a file with initial content
            writeFileSync(path, initialContent, options);

            assertWriteFileSync(path, newContent, options);
        }
    });

    it("should create parent directories if needed", async () => {
        expect.assertions(2);

        const path = join(distribution, "missing", "file.txt");
        const content = "Hello, World!";
        const options: WriteFileOptions = {
            overwrite: true,
            recursive: true,
        };

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeFile") {
            await assertWriteFile(path, content, options);
        } else {
            assertWriteFileSync(path, content, options);
        }
    });

    it("should handle path as URL or string", async () => {
        expect.assertions(2);

        const path = new URL(`file:///${join(distribution, "file.txt")}`);
        const content = "Hello, World!";

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeFile") {
            await assertWriteFile(path, content);
        } else {
            assertWriteFileSync(path, content);
        }
    });

    it("should throw error if path is invalid", async () => {
        expect.assertions(1);

        const path = null;
        const content = "Hello, World!";

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeFile") {
            // @ts-expect-error - just for testing this has the wrong type
            // eslint-disable-next-line vitest/no-conditional-expect
            await expect(writeFile(path, content)).rejects.toThrow("Path must be a non-empty string or URL.");
        } else {
            // @ts-expect-error - just for testing this has the wrong type
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(() => {
                writeFileSync(path, content);
            }).toThrow("Path must be a non-empty string or URL.");
        }
    });

    it("should throw error if content is invalid", async () => {
        expect.assertions(1);

        const path = "path/to/file.txt";
        const content = null;

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeFile") {
            // @ts-expect-error - this is just for tests
            // eslint-disable-next-line vitest/no-conditional-expect
            await expect(writeFile(path, content)).rejects.toThrow("File contents must be a string, ArrayBuffer, or ArrayBuffer view.");
        } else {
            // @ts-expect-error - this is just for tests
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(() => {
                writeFileSync(path, content);
            }).toThrow("File contents must be a string, ArrayBuffer, or ArrayBuffer view.");
        }
    });

    it("should keep a .bak copy when backup is true on an existing file", async () => {
        expect.assertions(3);

        const path = join(distribution, "file.txt");
        const backup = `${path}.bak`;

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeFile") {
            await writeFile(path, "first", { overwrite: true });
            await writeFile(path, "second", { backup: true, overwrite: true });
        } else {
            writeFileSync(path, "first", { overwrite: true });
            writeFileSync(path, "second", { backup: true, overwrite: true });
        }

        const fileContent = readFileSync(path, "utf8");
        const backupContent = readFileSync(backup, "utf8");

        expect(fileContent).toBe("second");
        expect(backupContent).toBe("first");
        await expect(isAccessible(backup, F_OK)).resolves.toBe(true);
    });

    it("should throw AlreadyExistsError when overwrite is false on an existing file", async () => {
        expect.assertions(2);

        const path = join(distribution, "file.txt");

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeFile") {
            await writeFile(path, "first", { overwrite: true });

            // eslint-disable-next-line vitest/no-conditional-expect
            await expect(writeFile(path, "second", { overwrite: false })).rejects.toThrow("EEXIST");
        } else {
            writeFileSync(path, "first", { overwrite: true });

            // eslint-disable-next-line vitest/no-conditional-expect
            expect(() => {
                writeFileSync(path, "second", { overwrite: false });
            }).toThrow("EEXIST");
        }

        // Existing content must be untouched
        expect(readFileSync(path, "utf8")).toBe("first");
    });

    it("should not leave a temp file behind after a successful write", async () => {
        expect.assertions(1);

        const path = join(distribution, "file.txt");

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeFile") {
            await writeFile(path, "content");
        } else {
            writeFileSync(path, "content");
        }

        const { readdirSync } = await import("node:fs");
        const leftovers = readdirSync(distribution).filter((entry) => entry.endsWith(".tmp"));

        expect(leftovers).toStrictEqual([]);
    });

    it("should accept Uint8Array content", async () => {
        expect.assertions(1);

        const path = join(distribution, "bytes.bin");
        const content = new Uint8Array([72, 105]); // "Hi"

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeFile") {
            await writeFile(path, content);
        } else {
            writeFileSync(path, content);
        }

        expect(readFileSync(path, "utf8")).toBe("Hi");
    });

    it("should honour an explicit mode option", async () => {
        expect.assertions(1);

        const path = join(distribution, "moded.txt");

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeFile") {
            await writeFile(path, "x", { mode: 0o600 });
        } else {
            writeFileSync(path, "x", { mode: 0o600 });
        }

        // Just verify file was created and content is right
        expect(readFileSync(path, "utf8")).toBe("x");
    });

    it.skipIf(process.platform === "win32")("should use the same default permissions as fs.writeFile (no world-writable chmod)", async () => {
        expect.assertions(2);

        const referencePath = join(distribution, "reference.txt");

        await nodeWriteFile(referencePath, "x");

        // eslint-disable-next-line no-bitwise
        const referenceMode = statSync(referencePath).mode & 0o777;

        const path = join(distribution, "default-mode.txt");

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeFile") {
            await writeFile(path, "x");
        } else {
            writeFileSync(path, "x");
        }

        // eslint-disable-next-line no-bitwise
        const mode = statSync(path).mode & 0o777;

        // Default writes must mirror Node's umask-filtered mode instead of an
        // unconditional world-writable 0o666.
        expect(mode).toBe(referenceMode);
        // eslint-disable-next-line no-bitwise
        expect(mode & 0o022).toBe(referenceMode & 0o022);
    });

    it("should append to the existing content when flag is 'a'", async () => {
        expect.assertions(1);

        const path = join(distribution, "append.txt");

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeFile") {
            await writeFile(path, "Hello");
            await writeFile(path, " World", { flag: "a" });
        } else {
            writeFileSync(path, "Hello");
            writeFileSync(path, " World", { flag: "a" });
        }

        expect(readFileSync(path, "utf8")).toBe("Hello World");
    });

    it("should throw when an exclusive flag is used and the file already exists", async () => {
        expect.assertions(1);

        const path = join(distribution, "exclusive.txt");

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeFile") {
            await writeFile(path, "first");

            // eslint-disable-next-line vitest/no-conditional-expect
            await expect(writeFile(path, "second", { flag: "wx" })).rejects.toThrow("file already exists");
        } else {
            writeFileSync(path, "first");

            // eslint-disable-next-line vitest/no-conditional-expect
            expect(() => writeFileSync(path, "second", { flag: "wx" })).toThrow("file already exists");
        }
    });

    it("should honour an explicit chown option (best-effort)", async () => {
        expect.assertions(1);

        const path = join(distribution, "chowned.txt");

        // Use current user's uid/gid so chown should succeed
        const uid = process.getuid?.() ?? 0;
        const gid = process.getgid?.() ?? 0;

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "writeFile") {
            await writeFile(path, "x", { chown: { gid, uid } });
        } else {
            writeFileSync(path, "x", { chown: { gid, uid } });
        }

        expect(readFileSync(path, "utf8")).toBe("x");
    });
});
