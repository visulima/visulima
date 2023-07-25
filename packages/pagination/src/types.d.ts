export interface PaginationMeta {
    firstPage: number;
    firstPageUrl: string | null;
    lastPage: number;
    lastPageUrl: string | null;
    nextPageUrl: string | null;
    page: number;
    perPage: number;
    previousPageUrl: string | null;
    total: number;
}

export interface PaginationResult<Result> {
    data: Result[];
    meta: PaginationMeta;
}

export interface Paginator<Result> extends Array<Result> {
    all: () => Result[];

    baseUrl: (url: string) => this;
    readonly currentPage: number;
    readonly firstPage: number;
    getMeta: () => PaginationMeta;
    getNextPageUrl: () => string | null;
    getPreviousPageUrl: () => string | null;
    getUrl: (page: number) => string;
    getUrlsForRange: (start: number, end: number) => { isActive: boolean; page: number; url: string }[];
    readonly hasMorePages: boolean;

    readonly hasPages: boolean;
    readonly hasTotal: boolean;
    readonly isEmpty: boolean;
    readonly lastPage: number;
    readonly perPage: number;
    queryString: (values: Record<string, unknown>) => this;
    toJSON: () => PaginationResult<Result>;
    readonly total: number;
}
