import { describe, expect, it, vi } from "vitest";

import readHandler from "../../src/handler/read";
import type { Adapter, ParsedQueryParameters } from "../../src/types";

describe(readHandler, () => {
    it("should return resource with status 200", async () => {
        expect.assertions(2);

        const resource = { id: 1, name: "Bob" };
        const adapter = {
            getOne: vi.fn<Adapter<any, any>["getOne"]>().mockResolvedValue(resource),
        } as unknown as Adapter<unknown, ParsedQueryParameters>;

        const result = await readHandler({
            adapter,
            query: {},
            resourceId: 1,
            resourceName: "users",
        });

        expect(adapter.getOne).toHaveBeenCalledWith("users", 1, {});
        expect(result).toStrictEqual({ data: resource, status: 200 });
    });

    it("should throw 404 when resource is not an object", async () => {
        expect.assertions(1);

        const adapter = {
            getOne: vi.fn<Adapter<any, any>["getOne"]>().mockResolvedValue(undefined),
        } as unknown as Adapter<unknown, ParsedQueryParameters>;

        await expect(
            readHandler({
                adapter,
                query: {},
                resourceId: 99,
                resourceName: "users",
            }),
        ).rejects.toMatchObject({ message: "users 99 not found", statusCode: 404 });
    });
});
