import { describe, expect, it } from "vitest";

import diskSpaceCheck from "../../src/checks/disk-space-check";

describe(diskSpaceCheck, () => {
    it("returns healthy with a generous ratio for the cwd", async () => {
        expect.assertions(2);

        const result = await diskSpaceCheck(process.cwd(), { minFreeRatio: 0 })();

        expect(result.health.healthy).toBe(true);
        expect(result.meta).toMatchObject({ free: expect.any(Number), total: expect.any(Number) });
    });

    it("returns unhealthy when requiring more free space than exists", async () => {
        expect.assertions(2);

        const result = await diskSpaceCheck(process.cwd(), { minFreeBytes: Number.MAX_SAFE_INTEGER })();

        expect(result.health.healthy).toBe(false);
        expect(result.health.message).toContain("below limit");
    });

    it("returns unhealthy for a non-existent path", async () => {
        expect.assertions(2);

        const result = await diskSpaceCheck("/this/path/does/not/exist/xyz")();

        expect(result.health.healthy).toBe(false);
        expect(result.meta).toStrictEqual({ path: "/this/path/does/not/exist/xyz" });
    });
});
