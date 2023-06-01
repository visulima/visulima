import { paginate } from "@visulima/pagination";

import type { ListHandler } from "../types.d";

type PaginationOptions = {
    page: number;
    perPage: number;
};

const listHandler: ListHandler = async ({
    adapter, query, resourceName, pagination,
}) => {
    let isPaginated = false;
    let paginationOptions: PaginationOptions | undefined;

    if (query.page !== undefined) {
        if (query.page <= 0) {
            throw new Error("page query must be a strictly positive number");
        }

        paginationOptions = {
            page: query.page,
            perPage: query.limit ?? pagination.perPage,
        };
    }

    if (paginationOptions) {
        isPaginated = true;

        // eslint-disable-next-line no-param-reassign
        query.skip = (paginationOptions.page - 1) * paginationOptions.perPage;
        // eslint-disable-next-line no-param-reassign
        query.limit = paginationOptions.perPage;
    }

    const resources = await adapter.getAll(resourceName, query);

    if (isPaginated) {
        const { page, total } = await adapter.getPaginationData(resourceName, query);

        const paginator = paginate(page, (paginationOptions as PaginationOptions).perPage, total, resources);

        return {
            data: paginator.toJSON(),
            status: 200,
        };
    }

    return {
        data: resources,
        status: 200,
    };
};

export default listHandler;
