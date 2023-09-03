import type { Adapter, MarshalFunction, PaginationData, ParsedQueryParameters, UnmarshalFunction } from "../../src/types.d";

class NoopAdapter implements Adapter<any, any, any> {
    public models: string[] = [];

    public constructor(models: string[] = []) {
        this.models = models;
    }

    // eslint-disable-next-line class-methods-use-this
    public async connect(): Promise<void> {
        return undefined;
    }

    // eslint-disable-next-line class-methods-use-this
    public async create(): Promise<unknown> {
        return {};
    }

    // eslint-disable-next-line class-methods-use-this
    public async delete(): Promise<unknown> {
        return {};
    }

    // eslint-disable-next-line class-methods-use-this
    public async disconnect(): Promise<void> {
        return undefined;
    }

    // eslint-disable-next-line class-methods-use-this
    public async getAll(): Promise<unknown[]> {
        return [];
    }

    public getModels(): string[] {
        return this.models;
    }

    // eslint-disable-next-line class-methods-use-this
    public async getOne(): Promise<unknown> {
        return {};
    }

    // eslint-disable-next-line class-methods-use-this
    public async getPaginationData(): Promise<PaginationData> {
        return {
            page: 1,
            pageCount: 1,
            total: 1,
        };
    }

    // eslint-disable-next-line class-methods-use-this
    public async handleError(): Promise<object> {
        return {};
    }

    // eslint-disable-next-line class-methods-use-this
    public async init(): Promise<void> {
        return undefined;
    }

    // eslint-disable-next-line class-methods-use-this
    public async mapModelsToRouteNames(): Promise<{ [p: number]: string; [p: string]: string; [p: symbol]: string }> {
        return {};
    }

    // eslint-disable-next-line class-methods-use-this
    public parseQuery(
        // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types,@typescript-eslint/no-unused-vars
        _resourceName: any,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _query: ParsedQueryParameters,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _serialization: {
            marshal: MarshalFunction;
            unmarshal: UnmarshalFunction;
        },
    ): any {}

    // eslint-disable-next-line class-methods-use-this
    public async update(): Promise<unknown> {
        return {};
    }
}

export default NoopAdapter;
