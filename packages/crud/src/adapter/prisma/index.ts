import {
    // @ts-ignore
    PrismaAction,
    // @ts-ignore
    PrismaClient,
} from "@prisma/client";
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

    models?: M[];

    private readonly _ctorModels?: M[];

    // private prismaJsonSchemaParser: PrismaJsonSchemaParser;
    private dmmf: any;

    constructor({
        primaryKey = "id", prismaClient, manyRelations = {}, models,
    }: AdapterCtorArguments<M>) {
        this.prismaClient = prismaClient;
        this.primaryKey = primaryKey;
        this.manyRelations = manyRelations;
        this._ctorModels = models;
    }

    private getPrismaClientModels = async () => {
        // @ts-ignore
        if (this.prismaClient._dmmf) {
            // @ts-ignore
            this.dmmf = this.prismaClient._dmmf;
            // @ts-ignore
            return this.dmmf?.mappingsMap;
            // @ts-ignore
        } if (this.prismaClient._getDmmf) {
            // @ts-ignore
            this.dmmf = await this.prismaClient._getDmmf();

            return this.dmmf.mappingsMap;
        }

        throw new Error("Couldn't get prisma client models");
    };

    async init() {
        const models = this._ctorModels;
        const prismaDmmfModels = await this.getPrismaClientModels();

        if (typeof models !== "undefined") {
            models.forEach((model) => {
                if (!Object.keys(prismaDmmfModels).includes(model)) {
                    throw new Error(`Model name ${model} is invalid.`);
                }
            });
        }

        this.models =
            // @ts-ignore
            models
            // @ts-ignore
            ?? (Object.keys(prismaDmmfModels) as M[]); // Retrieve model names from dmmf for prisma v2

        // this.prismaJsonSchemaParser = new PrismaJsonSchemaParser(this.prismaClient, this.dmmf);
    }

    async getPaginationData(resourceName: M, query: PrismaParsedQueryParameters): Promise<PaginationData> {
        // @ts-ignore
        const total: number = await this.getPrismaDelegate(resourceName).count({
            where: query.where,
            distinct: query.distinct,
        });

        return {
            total,
            pageCount: Math.ceil(total / (query.take as number)),
            page: Math.ceil((query.skip as number) / (query.take as number)) + 1,
        };
    }

    handleError(error: Error) {
        console.error(error);

        throw error.constructor.name === "PrismaClientKnownRequestError" || error.constructor.name === "PrismaClientValidationError" ? createHttpError(400, "invalid request, check your server logs for more info") : createHttpError(500, "an unknown error occured, check your server logs for more info");
    }

    parseQuery(resourceName: M, query: ParsedQueryParameters) {
        const parsed: PrismaParsedQueryParameters = {};

        if (query.select) {
            parsed.select = parsePrismaRecursiveField(query.select, "select");
        }

        if (query.include) {
            parsed.include = parsePrismaRecursiveField(query.include, "include");
        }

        if (query.originalQuery?.where) {
            parsed.where = parsePrismaWhere(JSON.parse(query.originalQuery.where), this.manyRelations[resourceName] ?? []);
        }

        if (query.orderBy) {
            parsed.orderBy = parsePrismaOrderBy(query.orderBy);
        }

        if (typeof query.limit !== "undefined") {
            parsed.take = query.limit;
        }

        if (typeof query.skip !== "undefined") {
            parsed.skip = query.skip;
        }

        if (query.originalQuery?.cursor) {
            parsed.cursor = parsePrismaCursor(JSON.parse(query.originalQuery.cursor));
        }

        if (query.distinct) {
            parsed.distinct = query.distinct;
        }

        return parsed;
    }

    async getAll(resourceName: M, query: PrismaParsedQueryParameters): Promise<T[]> {
        // @ts-ignore
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

    async getOne(resourceName: M, resourceId: string | number, query: PrismaParsedQueryParameters): Promise<T> {
        const delegate = this.getPrismaDelegate(resourceName);
        /**
         * On prisma v2.12, findOne has been deprecated in favor of findUnique
         * We use findUnique in priority only if it's available
         */
        const findFunction = delegate.findUnique || delegate.findOne;

        // @ts-ignore
        return findFunction({
            where: {
                [this.primaryKey]: resourceId,
            },
            select: query.select,
            include: query.include,
        });
    }

    async create(resourceName: M, data: any, query: PrismaParsedQueryParameters): Promise<T> {
        // @ts-ignore
        return this.getPrismaDelegate(resourceName).create({
            data,
            select: query.select,
            include: query.include,
        });
    }

    async update(resourceName: M, resourceId: string | number, data: any, query: PrismaParsedQueryParameters): Promise<T> {
        // @ts-ignore
        return this.getPrismaDelegate(resourceName).update({
            where: {
                [this.primaryKey]: resourceId,
            },
            data,
            select: query.select,
            include: query.include,
        });
    }

    async delete(resourceName: M, resourceId: string | number, query: PrismaParsedQueryParameters): Promise<T> {
        // @ts-ignore
        return this.getPrismaDelegate(resourceName).delete({
            where: {
                [this.primaryKey]: resourceId,
            },
            select: query.select,
            include: query.include,
        });
    }

    connect() {
        return this.prismaClient.$connect();
    }

    disconnect() {
        return this.prismaClient.$disconnect();
    }

    get client() {
        return this.prismaClient;
    }

    getModels() {
        return this.models || [];
    }

    private getPrismaDelegate(resourceName: M): Record<PrismaAction, (...arguments_: any[]) => Promise<T>> {
        return this.prismaClient[`${resourceName.charAt(0).toLowerCase()}${resourceName.slice(1)}`];
    }

    public async mapModelsToRouteNames() {
        return modelsToRouteNames(await this.getPrismaClientModels(), this.getModels());
    }
}
