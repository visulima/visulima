import "cross-fetch/polyfill";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { pingMock } = vi.hoisted(() => {
    return { pingMock: vi.fn<(host: string, options?: unknown) => Promise<{ alive: boolean }>>() };
});

vi.mock(import("pingman"), () => {
    return { default: pingMock };
});

// eslint-disable-next-line import/first
import pingCheck from "../../src/checks/ping-check";

describe("ping check (mocked transport)", () => {
    beforeEach(() => {
        pingMock.mockReset();
    });

    it("should return unhealthy when ping throws", async () => {
        expect.assertions(4);

        pingMock.mockRejectedValueOnce(new Error("ping spawn failed"));

        const result = await pingCheck("www.github.com")();

        expect(result.displayName).toBe("Ping check for www.github.com");
        expect(result.health.healthy).toBe(false);
        expect(result.health.message).toBe("ping spawn failed");
        expect(result.health.timestamp).toEqual(expect.any(String));
    });

    it("should strip the protocol from the host before pinging", async () => {
        expect.assertions(2);

        pingMock.mockResolvedValueOnce({ alive: true });

        const result = await pingCheck("https://www.github.com")();

        expect(pingMock).toHaveBeenCalledWith("www.github.com", undefined);
        expect(result.health.healthy).toBe(true);
    });
});
