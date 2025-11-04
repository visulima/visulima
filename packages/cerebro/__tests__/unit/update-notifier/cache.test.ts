import { describe, expect, it, vi } from "vitest";

import { getLastUpdate, saveLastUpdate } from "../../../src/plugins/update-notifier/cache";

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
});
