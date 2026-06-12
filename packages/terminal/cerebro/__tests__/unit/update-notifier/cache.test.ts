import { access, readFile } from "node:fs/promises";

import { findCacheDirSync } from "@visulima/find-cache-dir";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getLastUpdate, saveLastUpdate } from "../../../src/plugins/update-notifier/cache";

// Spy-based mocks (declared at module scope so vitest hoists them) that fall through to the real
// implementations by default; individual tests override return values via mockResolvedValueOnce.
vi.mock(import("node:fs/promises"), async () => {
    const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");

    return { ...actual, access: vi.fn(actual.access), readFile: vi.fn(actual.readFile) };
});
vi.mock(import("@visulima/find-cache-dir"), async () => {
    const actual = await vi.importActual<typeof import("@visulima/find-cache-dir")>("@visulima/find-cache-dir");

    return { ...actual, findCacheDirSync: vi.fn(actual.findCacheDirSync) };
});

vi.useFakeTimers().setSystemTime(new Date("2022-01-01"));

const fakeTime = new Date("2022-01-01").getTime();

describe("update-notifier/cache", () => {
    it("can save update then get the update details", async () => {
        expect.assertions(1);

        await saveLastUpdate("test");

        await expect(getLastUpdate("test")).resolves.toBe(fakeTime);
    });

    it("prefixed module can save update then get the update details", async () => {
        expect.assertions(1);

        await saveLastUpdate("@visulima/test");

        await expect(getLastUpdate("@visulima/test")).resolves.toBe(fakeTime);
    });

    describe("error and fallback paths", () => {
        afterEach(() => {
            vi.mocked(findCacheDirSync).mockReset();
            vi.mocked(access).mockReset();
            vi.mocked(readFile).mockReset();
        });

        it("throws when the cache directory cannot be resolved", async () => {
            expect.assertions(1);

            vi.mocked(findCacheDirSync).mockReturnValueOnce(undefined);

            await expect(getLastUpdate("missing-cache-dir")).rejects.toThrow("Could not find cache directory");
        });

        it("returns undefined when the cache file does not exist", async () => {
            expect.assertions(1);

            vi.mocked(findCacheDirSync).mockReturnValue("/var/cerebro-test-cache");
            vi.mocked(access).mockRejectedValueOnce(new Error("ENOENT"));

            await expect(getLastUpdate("no-file")).resolves.toBeUndefined();
        });

        it("returns undefined when the cache file contains invalid JSON", async () => {
            expect.assertions(1);

            vi.mocked(findCacheDirSync).mockReturnValue("/var/cerebro-test-cache");
            vi.mocked(access).mockResolvedValueOnce(undefined);
            // @ts-expect-error - readFile overload returns string for utf8 encoding
            vi.mocked(readFile).mockResolvedValueOnce("not valid json");

            await expect(getLastUpdate("bad-json")).resolves.toBeUndefined();
        });
    });
});
