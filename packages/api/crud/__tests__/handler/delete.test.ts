import { describe, expect, it, vi } from "vitest";

import deleteHandler from "../../src/handler/delete";
import type { Adapter, ParsedQueryParameters } from "../../src/types";

describe(deleteHandler, () => {
    it("should return deleted resource with status 200 when resource exists", async () => {
        expect.assertions(3);

        const deleted = { id: 1, name: "Removed" };
        const adapter = {
            delete: vi.fn<Adapter<any, any>["delete"]>().mockResolvedValue(deleted),
            getOne: vi.fn<Adapter<any, any>["getOne"]>().mockResolvedValue({ id: 1, name: "Removed" }),
        } as unknown as Adapter<unknown, ParsedQueryParameters>;

        const result = await deleteHandler({
            adapter,
            query: {},
            resourceId: 1,
            resourceName: "users",
        });

        expect(adapter.getOne).toHaveBeenCalledWith("users", 1, {});
        expect(adapter.delete).toHaveBeenCalledWith("users", 1, {});
        expect(result).toStrictEqual({ data: deleted, status: 200 });
    });

    it("should throw 404 when resource not found", async () => {
        expect.assertions(2);

        const adapter = {
            delete: vi.fn<Adapter<any, any>["delete"]>(),
            getOne: vi.fn<Adapter<any, any>["getOne"]>().mockResolvedValue(undefined),
        } as unknown as Adapter<unknown, ParsedQueryParameters>;

        await expect(
            deleteHandler({
                adapter,
                query: {},
                resourceId: "abc",
                resourceName: "users",
            }),
        ).rejects.toMatchObject({ message: "users abc not found", statusCode: 404 });

        expect(adapter.delete).not.toHaveBeenCalled();
    });
});
