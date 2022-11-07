export type PaginationResult<Result> = { meta: PaginationMeta; data: Result[] };
export type PaginationMeta = {
    total: number;
    perPage: number;
    page: number;
    lastPage: number;
    firstPage: number;
    firstPageUrl: null | string;
    lastPageUrl: null | string;
    nextPageUrl: null | string;
    previousPageUrl: null | string;
};

export interface SimplePaginator<Result> extends Array<Result> {
    all(): Result[];

    readonly firstPage: number;
    readonly perPage: number;
    readonly currentPage: number;
    readonly lastPage: number;
    readonly hasPages: boolean;
    readonly hasMorePages: boolean;
    readonly isEmpty: boolean;
    readonly total: number;
    readonly hasTotal: boolean;

    baseUrl(url: string): this;
    queryString(values: { [key: string]: any }): this;
    getUrl(page: number): string;
    getMeta(): PaginationMeta;
    getNextPageUrl(): string | null;
    getPreviousPageUrl(): string | null;
    getUrlsForRange(start: number, end: number): { url: string; page: number; isActive: boolean }[];
    toJSON(): PaginationResult<Result>;
}
