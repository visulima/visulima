import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import RotatingFileStream from "../../../../../src/reporter/file/utils/rotating-file-stream";

let directory: string;

const logPath = (name: string): string => join(directory, name);

const waitForContent = async (path: string, expected: string, timeout = 2000): Promise<string> => {
    const start = Date.now();

    while (Date.now() - start < timeout) {
        try {
            const content = readFileSync(path, "utf8");

            if (content.includes(expected)) {
                return content;
            }
        } catch {
            // file not created yet
        }

        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => {
            setTimeout(resolve, 25);
        });
    }

    throw new Error(`Timed out waiting for "${expected}" in ${path}`);
};

describe(RotatingFileStream, () => {
    beforeEach(() => {
        directory = mkdtempSync(join(tmpdir(), "pail-rfs-"));
    });

    afterEach(() => {
        rmSync(directory, { force: true, recursive: true });
    });

    it("should write through a persistent stream in buffered mode", async () => {
        expect.assertions(1);

        const path = logPath("buffered.log");
        const rfs = new RotatingFileStream(path, false);

        rfs.write("buffered-message\n");
        rfs.end();

        await expect(waitForContent(path, "buffered-message")).resolves.toContain("buffered-message");
    });

    it("should write through a fresh stream on each write in immediate mode", async () => {
        expect.assertions(1);

        const path = logPath("immediate.log");
        const rfs = new RotatingFileStream(path, true);

        rfs.write("immediate-one\n");
        rfs.write("immediate-two\n");

        const content = await waitForContent(path, "immediate-two");

        expect(content).toContain("immediate-one");
    });

    it("should not throw on end when no buffered stream exists", () => {
        expect.assertions(1);

        const rfs = new RotatingFileStream(logPath("no-stream.log"), true);

        expect(() => {
            rfs.end();
        }).not.toThrow();
    });
});
