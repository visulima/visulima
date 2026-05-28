import { describe, expect, it, vi } from "vitest";

import updateHandler from "../../src/handler/update";
import type { Adapter, ParsedQueryParameters } from "../../src/types";

describe(updateHandler, () => {
    it("should return updated resource with status 201 when resource exists", async () => {
        expect.assertions(3);

        const updated = { id: 1, name: "Updated" };
        const adapter = {
            getOne: vi.fn<Adapter<any, any>["getOne"]>().mockResolvedValue({ id: 1, name: "Old" }),
            update: vi.fn<Adapter<any, any>["update"]>().mockResolvedValue(updated),
        } as unknown as Adapter<unknown, ParsedQueryParameters>;
        const request = { body: { name: "Updated" } } as unknown as Request & { body: Partial<unknown> };

        const result = await updateHandler({
            adapter,
            query: {},
            request,
            resourceId: 1,
            resourceName: "users",
        });

        expect(adapter.getOne).toHaveBeenCalledWith("users", 1, {});
        expect(adapter.update).toHaveBeenCalledWith("users", 1, { name: "Updated" }, {});
        expect(result).toStrictEqual({ data: updated, status: 201 });
    });

    it("should throw 404 when resource not found", async () => {
        expect.assertions(2);

        const adapter = {
            getOne: vi.fn<Adapter<any, any>["getOne"]>().mockResolvedValue(undefined),
            update: vi.fn<Adapter<any, any>["update"]>(),
        } as unknown as Adapter<unknown, ParsedQueryParameters>;
        const request = { body: {} } as unknown as Request & { body: Partial<unknown> };

        await expect(
            updateHandler({
                adapter,
                query: {},
                request,
                resourceId: 7,
                resourceName: "users",
            }),
        ).rejects.toMatchObject({ message: "users 7 not found", statusCode: 404 });

        expect(adapter.update).not.toHaveBeenCalled();
    });
});
