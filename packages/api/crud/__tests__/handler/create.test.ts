import { describe, expect, it, vi } from "vitest";

import createHandler from "../../src/handler/create";
import type { Adapter, ParsedQueryParameters } from "../../src/types";

describe(createHandler, () => {
    it("should call adapter.create and return data with status 201", async () => {
        expect.assertions(2);

        const created = { id: 1, name: "Alice" };
        const adapter = {
            create: vi.fn<Adapter<any, any>["create"]>().mockResolvedValue(created),
        } as unknown as Adapter<unknown, ParsedQueryParameters>;
        const request = { body: { name: "Alice" } } as unknown as Request & { body: Record<string, unknown> };

        const result = await createHandler({
            adapter,
            query: {},
            request,
            resourceName: "users",
        });

        expect(adapter.create).toHaveBeenCalledWith("users", { name: "Alice" }, {});
        expect(result).toStrictEqual({ data: created, status: 201 });
    });

    it("should propagate adapter errors", async () => {
        expect.assertions(1);

        const adapter = {
            create: vi.fn<Adapter<any, any>["create"]>().mockRejectedValue(new Error("boom")),
        } as unknown as Adapter<unknown, ParsedQueryParameters>;
        const request = { body: {} } as unknown as Request & { body: Record<string, unknown> };

        await expect(
            createHandler({
                adapter,
                query: {},
                request,
                resourceName: "users",
            }),
        ).rejects.toThrow("boom");
    });
});
