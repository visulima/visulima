import type {
    // @ts-expect-error -- PrismaAction may not be exported by the consumer's generated client
    PrismaAction,
} from "@prisma/client";
import type { HttpError } from "http-errors";
import createHttpError from "http-errors";

import type { Adapter, FakePrismaClient, PaginationData, ParsedQueryParameters } from "../../types";
import type { PrismaParsedQueryParameters } from "./types";
import modelsToRouteNames from "./utils/models-to-route-names";
import parsePrismaCursor from "./utils/parse-cursor";
import parsePrismaOrderBy from "./utils/parse-order-by";
import parsePrismaRecursiveField from "./utils/parse-recursive";
import parsePrismaWhere from "./utils/parse-where";

/**
 * The shape of `Prisma.dmmf` exposed by Prisma 5/6 generated clients. Only the
 * model names are needed by this adapter.
 */
interface PrismaDmmf {
    datamodel?: {
        models?: { name: string }[];
    };
}

interface AdapterCtorArguments<M extends string, PrismaClient> {
    /**
     * When `true` (default) ISO date-looking strings in `where` filters are
     * coerced to `Date` instances so they match Prisma `DateTime` columns. Set
     * to `false` to keep them as strings — required when filtering a *string*
     * column whose values happen to look like dates.
     */
    coerceWhereDates?: boolean;

    /**
     * The `Prisma.dmmf` object from your generated client
     * (`import { Prisma } from "@prisma/client"`). Required for Prisma 5/6,
     * where the private `_dmmf`/`_getDmmf` internals this adapter used to read
     * were removed. If omitted, the adapter falls back to those internals for
     * Prisma 3/4 compatibility, then to `prismaClient._runtimeDataModel`.
     */
    dmmf?: PrismaDmmf;
    manyRelations?: {
        [key in M]?: string[];
    };
    models?: M[];
    primaryKey?: string;
    prismaClient: PrismaClient;
}

type Delegate<T> = Record<PrismaAction, (...arguments_: any[]) => Promise<T>>;

export default class PrismaAdapter<T, M extends string, PrismaClient> implements Adapter<T, PrismaParsedQueryParameters, M> {
    public models?: M[];

    private readonly ctorModels?: M[];

    private dmmf: { mappingsMap: Record<string, object> } | undefined;

    private readonly manyRelations: {
        [key in M]?: string[];
    };

    private readonly primaryKey: string;

    private readonly prismaClient: FakePrismaClient & PrismaClient;

    private readonly coerceWhereDates: boolean;

    private readonly ctorDmmf?: PrismaDmmf;

    public constructor({
        coerceWhereDates = true,
        dmmf,
        manyRelations = {},
        models,
        primaryKey = "id",
        prismaClient,
    }: AdapterCtorArguments<M, FakePrismaClient & PrismaClient>) {
        this.prismaClient = prismaClient;
        this.primaryKey = primaryKey;
        this.manyRelations = manyRelations;
        this.ctorModels = models as M[];
        this.coerceWhereDates = coerceWhereDates;
        this.ctorDmmf = dmmf;
    }

    public async connect(): Promise<void> {
        await this.prismaClient.$connect();
    }

    public async create(resourceName: M, data: unknown, query: PrismaParsedQueryParameters): Promise<T> {
        // @ts-expect-error -- delegate type is dynamic per Prisma model, not statically resolvable
        return await this.getPrismaDelegate(resourceName).create({
            data,
            include: query.include,
            select: query.select,
        });
    }

    public async delete(resourceName: M, resourceId: number | string, query: PrismaParsedQueryParameters): Promise<T> {
        // @ts-expect-error -- delegate type is dynamic per Prisma model, not statically resolvable
        return await this.getPrismaDelegate(resourceName).delete({
            include: query.include,
            select: query.select,
            where: {
                [this.primaryKey]: resourceId,
            },
        });
    }

    public async disconnect(): Promise<void> {
        await this.prismaClient.$disconnect();
    }

    public async getAll(resourceName: M, query: PrismaParsedQueryParameters): Promise<T[]> {
        // @ts-expect-error -- delegate type is dynamic per Prisma model, not statically resolvable
        return (await this.getPrismaDelegate(resourceName).findMany({
            cursor: query.cursor,
            distinct: query.distinct,
            include: query.include,
            orderBy: query.orderBy,
            select: query.select,
            skip: query.skip,
            take: query.take,
            where: query.where,
        })) as T[];
    }

    public getModels(): M[] {
        return this.models ?? [];
    }

    public async getOne(resourceName: M, resourceId: number | string, query: PrismaParsedQueryParameters): Promise<T> {
        const delegate = this.getPrismaDelegate(resourceName);

        /**
         * On prisma v2.12, findOne has been deprecated in favor of findUnique
         * We use findUnique in priority only if it's available
         */
        const findFunction = delegate.findUnique ?? delegate.findOne;

        // @ts-expect-error -- delegate type is dynamic per Prisma model, not statically resolvable
        return await findFunction({
            include: query.include,
            select: query.select,
            where: {
                [this.primaryKey]: resourceId,
            },
        });
    }

    public async getPaginationData(resourceName: M, query: PrismaParsedQueryParameters): Promise<PaginationData> {
        // @ts-expect-error -- delegate type is dynamic per Prisma model, not statically resolvable
        const total: number = await this.getPrismaDelegate(resourceName).count({
            distinct: query.distinct,
            where: query.where,
        });

        const take = query.take ?? 0;

        return {
            page: take > 0 ? Math.ceil((query.skip ?? 0) / take) + 1 : 1,
            pageCount: take > 0 ? Math.ceil(total / take) : 0,
            total,
        };
    }

    // eslint-disable-next-line class-methods-use-this
    public handleError(error: Error): HttpError {
        // eslint-disable-next-line no-console
        console.error(error);

        if (error instanceof Error && error.stack) {
            // eslint-disable-next-line no-console
            console.error(error.stack);
        }

        throw error.constructor.name === "PrismaClientKnownRequestError" || error.constructor.name === "PrismaClientValidationError"
            ? createHttpError(400, "invalid request, check your server logs for more info")
            : createHttpError(500, "an unknown error occured, check your server logs for more info");
    }

    public async init(): Promise<void> {
        const models = this.ctorModels;
        const prismaDmmfModels = await this.getPrismaClientModels();

        if (models !== undefined) {
            models.forEach((model) => {
                if (!Object.keys(prismaDmmfModels).includes(model)) {
                    throw new Error(`Model name ${model} is invalid.`);
                }
            });
        }

        this.models = models ?? (Object.keys(prismaDmmfModels) as M[]); // Retrieve model names from dmmf for prisma v2
    }

    public async mapModelsToRouteNames(): Promise<{ [key in M]?: string }> {
        return modelsToRouteNames(await this.getPrismaClientModels(), this.getModels());
    }

    public parseQuery(resourceName: M, query: ParsedQueryParameters): PrismaParsedQueryParameters {
        const parsed: PrismaParsedQueryParameters = {};

        if (query.select) {
            parsed.select = parsePrismaRecursiveField(query.select, "select");
        }

        if (query.include) {
            parsed.include = parsePrismaRecursiveField(query.include, "include");
        }

        if (query.where) {
            parsed.where = parsePrismaWhere(query.where, this.manyRelations[resourceName] ?? [], this.coerceWhereDates);
        }

        if (query.orderBy) {
            parsed.orderBy = parsePrismaOrderBy(query.orderBy);
        }

        if (query.limit !== undefined) {
            parsed.take = query.limit;
        }

        if (query.skip !== undefined) {
            parsed.skip = query.skip;
        }

        if (query.originalQuery?.cursor) {
            parsed.cursor = parsePrismaCursor(JSON.parse(query.originalQuery.cursor) as Record<string, boolean | number | string>);
        }

        if (query.distinct) {
            parsed.distinct = query.distinct;
        }

        return parsed;
    }

    public async update(resourceName: M, resourceId: number | string, data: unknown, query: PrismaParsedQueryParameters): Promise<T> {
        // @ts-expect-error -- delegate type is dynamic per Prisma model, not statically resolvable
        return await this.getPrismaDelegate(resourceName).update({
            data,
            include: query.include,
            select: query.select,
            where: {
                [this.primaryKey]: resourceId,
            },
        });
    }

    public get client(): PrismaClient {
        return this.prismaClient;
    }

    private readonly getPrismaClientModels = async (): Promise<Record<string, object>> => {
        // Prisma 5/6: model metadata is exposed via the public `Prisma.dmmf`
        // (passed to the constructor) or, as a fallback, the client's
        // `_runtimeDataModel`. The legacy `_dmmf`/`_getDmmf` internals were removed.
        // Model names are kept in their original (PascalCase) form to match the
        // `mappingsMap` keys the legacy DMMF path returned; `getPrismaDelegate`
        // lowercases the first character to find the delegate on the client.
        const modelsFromDatamodel = this.ctorDmmf?.datamodel?.models;

        if (modelsFromDatamodel !== undefined) {
            return Object.fromEntries(modelsFromDatamodel.map((model) => [model.name, {}]));
        }

        // eslint-disable-next-line no-underscore-dangle -- Prisma 5/6 exposes the runtime data model under this private key
        const runtimeModels = (this.prismaClient as { _runtimeDataModel?: { models?: Record<string, object> } })._runtimeDataModel?.models;

        if (runtimeModels !== undefined) {
            return Object.fromEntries(Object.keys(runtimeModels).map((name) => [name, {}]));
        }

        // Prisma 3/4 compatibility: private DMMF internals.
        // eslint-disable-next-line no-underscore-dangle
        if (this.prismaClient._dmmf !== undefined) {
            // eslint-disable-next-line no-underscore-dangle
            this.dmmf = this.prismaClient._dmmf as { mappingsMap: Record<string, object> };

            return this.dmmf.mappingsMap;
        }

        // eslint-disable-next-line no-underscore-dangle
        if (this.prismaClient._getDmmf !== undefined) {
            // eslint-disable-next-line no-underscore-dangle
            this.dmmf = (await this.prismaClient._getDmmf()) as { mappingsMap: Record<string, object> };

            return this.dmmf.mappingsMap;
        }

        throw new Error("Couldn't get prisma client models. For Prisma 5/6 pass `dmmf: Prisma.dmmf` to the PrismaAdapter constructor.");
    };

    private getPrismaDelegate(resourceName: M): Delegate<T> {
        return this.prismaClient[`${resourceName.charAt(0).toLowerCase()}${resourceName.slice(1)}`] as Delegate<T>;
    }
}
