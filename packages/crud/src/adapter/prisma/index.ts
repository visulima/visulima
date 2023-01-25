// This @typescript-eslint/consistent-type-imports is need to be disabled because of the dts in the tsup.config.ts file.
// eslint-disable-next-line import/no-extraneous-dependencies,@typescript-eslint/consistent-type-imports
import {
    // @ts-expect-error
    PrismaAction,
    PrismaClient,
} from "@prisma/client";
import type { HttpError } from "http-errors";
import createHttpError from "http-errors";

import type { Adapter, PaginationData, ParsedQueryParameters } from "../../types.d";
import type { PrismaParsedQueryParameters } from "./types.d";
import modelsToRouteNames from "./utils/models-to-route-names";
import parsePrismaCursor from "./utils/parse-cursor";
import parsePrismaOrderBy from "./utils/parse-order-by";
import parsePrismaRecursiveField from "./utils/parse-recursive";
import parsePrismaWhere from "./utils/parse-where";

interface AdapterCtorArguments<M extends string = string> {
    primaryKey?: string;
    manyRelations?: {
        [key in M]?: string[];
    };
    prismaClient: PrismaClient;
    models?: M[];
}

export default class PrismaAdapter<T, M extends string> implements Adapter<T, PrismaParsedQueryParameters, M> {
    private readonly primaryKey: string;

    private readonly manyRelations: {
        [key in M]?: string[];
    };

    private readonly prismaClient: PrismaClient;

    public models?: M[];

    private readonly ctorModels?: M[];

    private dmmf: any;

    public constructor({
        primaryKey = "id", prismaClient, manyRelations = {}, models,
    }: AdapterCtorArguments<M>) {
        this.prismaClient = prismaClient;
        this.primaryKey = primaryKey;
        this.manyRelations = manyRelations;
        this.ctorModels = models;
    }

    private getPrismaClientModels = async () => {
        // eslint-disable-next-line no-underscore-dangle
        if (this.prismaClient._dmmf) {
            // eslint-disable-next-line no-underscore-dangle
            this.dmmf = this.prismaClient._dmmf;

            return this.dmmf?.mappingsMap;
        }

        // eslint-disable-next-line no-underscore-dangle
        if (this.prismaClient._getDmmf) {
            // eslint-disable-next-line no-underscore-dangle
            this.dmmf = await this.prismaClient._getDmmf();

            return this.dmmf.mappingsMap;
        }

        throw new Error("Couldn't get prisma client models");
    };

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

    public async getPaginationData(resourceName: M, query: PrismaParsedQueryParameters): Promise<PaginationData> {
        // @ts-expect-error
        const total: number = await this.getPrismaDelegate(resourceName).count({
            where: query.where,
            distinct: query.distinct,
        });

        return {
            total,
            pageCount: Math.ceil(total / (query.take ?? 0)),
            page: Math.ceil((query.skip ?? 0) / (query.take ?? 0)) + 1,
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

    public parseQuery(resourceName: M, query: ParsedQueryParameters): PrismaParsedQueryParameters {
        const parsed: PrismaParsedQueryParameters = {};

        if (query.select) {
            parsed.select = parsePrismaRecursiveField(query.select, "select");
        }

        if (query.include) {
            parsed.include = parsePrismaRecursiveField(query.include, "include");
        }

        if (query.originalQuery?.["where"]) {
            parsed.where = parsePrismaWhere(JSON.parse(query.originalQuery["where"]), this.manyRelations[resourceName] ?? []);
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

        if (query.originalQuery?.["cursor"]) {
            parsed.cursor = parsePrismaCursor(JSON.parse(query.originalQuery["cursor"]));
        }

        if (query.distinct) {
            parsed.distinct = query.distinct;
        }

        return parsed;
    }

    public async getAll(resourceName: M, query: PrismaParsedQueryParameters): Promise<T[]> {
        // @ts-expect-error
        return (await this.getPrismaDelegate(resourceName).findMany({
            select: query.select,
            include: query.include,
            where: query.where,
            orderBy: query.orderBy,
            cursor: query.cursor,
            take: query.take,
            skip: query.skip,
            distinct: query.distinct,
        })) as T[];
    }

    public async getOne(resourceName: M, resourceId: number | string, query: PrismaParsedQueryParameters): Promise<T> {
        const delegate = this.getPrismaDelegate(resourceName);
        /**
         * On prisma v2.12, findOne has been deprecated in favor of findUnique
         * We use findUnique in priority only if it's available
         */
        const findFunction = delegate["findUnique"] ?? delegate["findOne"];

        // @ts-expect-error
        return findFunction({
            where: {
                [this.primaryKey]: resourceId,
            },
            select: query.select,
            include: query.include,
        });
    }

    public async create(resourceName: M, data: unknown, query: PrismaParsedQueryParameters): Promise<T> {
        // @ts-expect-error
        return this.getPrismaDelegate(resourceName).create({
            data,
            select: query.select,
            include: query.include,
        });
    }

    public async update(resourceName: M, resourceId: number | string, data: unknown, query: PrismaParsedQueryParameters): Promise<T> {
        // @ts-expect-error
        return this.getPrismaDelegate(resourceName).update({
            where: {
                [this.primaryKey]: resourceId,
            },
            data,
            select: query.select,
            include: query.include,
        });
    }

    public async delete(resourceName: M, resourceId: number | string, query: PrismaParsedQueryParameters): Promise<T> {
        // @ts-expect-error
        return this.getPrismaDelegate(resourceName).delete({
            where: {
                [this.primaryKey]: resourceId,
            },
            select: query.select,
            include: query.include,
        });
    }

    public async connect(): Promise<void> {
        this.prismaClient.$connect();
    }

    public async disconnect(): Promise<void> {
        this.prismaClient.$disconnect();
    }

    public get client(): PrismaClient {
        return this.prismaClient;
    }

    public getModels(): M[] {
        return this.models ?? [];
    }

    public async mapModelsToRouteNames(): Promise<{ [key in M]?: string }> {
        return modelsToRouteNames(await this.getPrismaClientModels(), this.getModels());
    }

    private getPrismaDelegate(resourceName: M): Record<PrismaAction, (...arguments_: any[]) => Promise<T>> {
        return this.prismaClient[`${resourceName.charAt(0).toLowerCase()}${resourceName.slice(1)}`];
    }
}
