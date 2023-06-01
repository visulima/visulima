import type { PrismaParsedQueryParameters } from "../../src/adapter/prisma/types.d";
import type { Adapter, PaginationData, ParsedQueryParameters } from "../../src/types.d";

class NoopAdapter implements Adapter<unknown, ParsedQueryParameters> {
    public models: string[] = [];

    public constructor(models: string[] = []) {
        this.models = models;
    }

    // eslint-disable-next-line class-methods-use-this
    public async getPaginationData(): Promise<PaginationData> {
        return {
            total: 1,
            pageCount: 1,
            page: 1,
        };
    }

    // eslint-disable-next-line class-methods-use-this
    public parseQuery(): PrismaParsedQueryParameters {
        return {};
    }

    // eslint-disable-next-line class-methods-use-this
    public async getAll(): Promise<unknown[]> {
        return [];
    }

    // eslint-disable-next-line class-methods-use-this
    public async getOne(): Promise<unknown> {
        return {};
    }

    // eslint-disable-next-line class-methods-use-this
    public async create(): Promise<unknown> {
        return {};
    }

    // eslint-disable-next-line class-methods-use-this
    public async update(): Promise<unknown> {
        return {};
    }

    // eslint-disable-next-line class-methods-use-this
    public async delete(): Promise<unknown> {
        return {};
    }

    // eslint-disable-next-line class-methods-use-this
    public async handleError(): Promise<object> {
        return {};
    }

    // eslint-disable-next-line class-methods-use-this
    public getModels(): string[] {
        return this.models;
    }
}

export default NoopAdapter;
