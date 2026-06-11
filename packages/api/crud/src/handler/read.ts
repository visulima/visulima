import createHttpError from "http-errors";

import type { GetHandler } from "../types";

const readHandler: GetHandler = async ({ adapter, query, resourceId, resourceName }) => {
    const resource = await adapter.getOne(resourceName, resourceId, query);

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard: adapter.getOne is typed Promise<T> but Prisma's findUnique resolves null when no record matches
    if (!resource) {
        throw createHttpError(404, `${resourceName} ${String(resourceId)} not found`);
    }

    return {
        data: resource,
        status: 200,
    };
};

export default readHandler;
