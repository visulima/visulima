import { get } from "node:https";
import Stream from "node:stream";

import type { Mock } from "vitest";
import { describe, expect, it, vi } from "vitest";

import getDistributionVersion from "../../../src/update-notifier/get-dist-version";

const registryUrl = "https://registry.npmjs.org/-/package/__NAME__/dist-tags";

vi.mock(import("node:https"), async () => {
    const actual = await vi.importActual("https");

    return {
        // @ts-expect-error - Mock
        ...actual,
        get: vi.fn(),
    };
});

describe("update-notifier/get-dist-version", () => {
    it("valid response returns version", async () => {
        expect.assertions(1);

        const st = new Stream();

        vi.mocked(get).mockImplementation((_, callback) => {
            callback(st);

            st.emit("data", "{\"latest\":\"1.0.0\"}");
            st.emit("end");
        });

        const version = await getDistributionVersion("test", "latest", registryUrl);

        expect(version).toBe("1.0.0");
    });

    it("invalid response throws error", async () => {
        expect.assertions(1);

        const st = new Stream();

        vi.mocked(get).mockImplementation((_, callback) => {
            callback(st);

            st.emit("data", "some invalid json");
            st.emit("end");
        });

        await expect(getDistributionVersion("test", "latest", registryUrl)).rejects.toThrow("Could not parse version response");
    });
});
