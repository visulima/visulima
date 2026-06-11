import createHttpError from "http-errors";

import type { DeleteHandler } from "../types";

const deleteHandler: DeleteHandler = async ({ adapter, query, resourceId, resourceName }) => {
    const resource = await adapter.getOne(resourceName, resourceId, query);

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard: adapter.getOne is typed Promise<T> but Prisma's findUnique resolves null when no record matches
    if (resource) {
        const deletedResource = await adapter.delete(resourceName, resourceId, query);

        return {
            data: deletedResource,
            status: 200,
        };
    }

    throw createHttpError(404, `${resourceName} ${String(resourceId)} not found`);
};

export default deleteHandler;
