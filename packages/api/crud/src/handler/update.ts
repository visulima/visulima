import createHttpError from "http-errors";

import type { UpdateHandler } from "../types";

const updateHandler: UpdateHandler = async ({ adapter, query, request, resourceId, resourceName }) => {
    const resource = await adapter.getOne(resourceName, resourceId, query);

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard: adapter.getOne is typed Promise<T> but Prisma's findUnique resolves null when no record matches
    if (resource) {
        const updatedResource = await adapter.update(resourceName, resourceId, request.body, query);

        return {
            data: updatedResource,
            status: 200,
        };
    }

    throw createHttpError(404, `${resourceName} ${String(resourceId)} not found`);
};

export default updateHandler;
