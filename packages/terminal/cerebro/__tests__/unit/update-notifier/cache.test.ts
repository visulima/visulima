import { existsSync, readFileSync } from "node:fs";

import { findCacheDirSync } from "@visulima/find-cache-dir";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getLastUpdate, saveLastUpdate } from "../../../src/plugins/update-notifier/cache";

// Spy-based mocks (declared at module scope so vitest hoists them) that fall through to the real
// implementations by default; individual tests override return values via mockReturnValueOnce.
vi.mock(import("node:fs"), async () => {
    const actual = await vi.importActual<typeof import("node:fs")>("node:fs");

    return { ...actual, existsSync: vi.fn(actual.existsSync), readFileSync: vi.fn(actual.readFileSync) };
});
vi.mock(import("@visulima/find-cache-dir"), async () => {
    const actual = await vi.importActual<typeof import("@visulima/find-cache-dir")>("@visulima/find-cache-dir");

    return { ...actual, findCacheDirSync: vi.fn(actual.findCacheDirSync) };
});

vi.useFakeTimers().setSystemTime(new Date("2022-01-01"));

const fakeTime = new Date("2022-01-01").getTime();

describe("update-notifier/cache", () => {
    it("can save update then get the update details", () => {
        expect.assertions(1);

        saveLastUpdate("test");

        expect(getLastUpdate("test")).toBe(fakeTime);
    });

    it("prefixed module can save update then get the update details", () => {
        expect.assertions(1);

        saveLastUpdate("@visulima/test");

        expect(getLastUpdate("@visulima/test")).toBe(fakeTime);
    });

    describe("error and fallback paths", () => {
        afterEach(() => {
            vi.mocked(findCacheDirSync).mockReset();
            vi.mocked(existsSync).mockReset();
            vi.mocked(readFileSync).mockReset();
        });

        it("throws when the cache directory cannot be resolved", () => {
            expect.assertions(1);

            vi.mocked(findCacheDirSync).mockReturnValueOnce(undefined);

            expect(() => getLastUpdate("missing-cache-dir")).toThrow("Could not find cache directory");
        });

        it("returns undefined when the cache file does not exist", () => {
            expect.assertions(1);

            vi.mocked(findCacheDirSync).mockReturnValue("/var/cerebro-test-cache");
            vi.mocked(existsSync).mockReturnValueOnce(false);

            expect(getLastUpdate("no-file")).toBeUndefined();
        });

        it("returns undefined when the cache file contains invalid JSON", () => {
            expect.assertions(1);

            vi.mocked(findCacheDirSync).mockReturnValue("/var/cerebro-test-cache");
            vi.mocked(existsSync).mockReturnValueOnce(true);
            // @ts-expect-error - readFileSync overload returns string for utf8 encoding
            vi.mocked(readFileSync).mockReturnValueOnce("not valid json");

            expect(getLastUpdate("bad-json")).toBeUndefined();
        });
    });
});
