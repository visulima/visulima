import { get } from "node:https";
import Stream from "node:stream";

import { describe, expect, it, vi } from "vitest";

import getDistributionVersion from "../../../src/plugins/update-notifier/get-distribution-version";

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

    it("rejects when the requested dist-tag is absent from the response", async () => {
        expect.assertions(1);

        const st = new Stream();

        vi.mocked(get).mockImplementation((_, callback) => {
            callback(st);

            // Valid JSON but the "latest" tag is missing, exercising the missing-version reject branch.
            st.emit("data", "{\"beta\":\"2.0.0-beta.1\"}");
            st.emit("end");
        });

        await expect(getDistributionVersion("test", "latest", registryUrl)).rejects.toThrow("Error getting version");
    });

    it("rejects when the underlying request emits an error", async () => {
        expect.assertions(1);

        const requestStream = new Stream();
        const responseStream = new Stream();

        vi.mocked(get).mockImplementation((_, callback) => {
            // Do not emit a response; instead surface a transport-level error.
            callback(responseStream);

            queueMicrotask(() => {
                requestStream.emit("error", new Error("socket hang up"));
            });

            return requestStream as never;
        });

        await expect(getDistributionVersion("test", "latest", registryUrl)).rejects.toThrow("socket hang up");
    });
});
