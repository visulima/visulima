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
    getMeta(): any;
    getNextPageUrl(): string | null;
    getPreviousPageUrl(): string | null;
    getUrlsForRange(start: number, end: number): { url: string; page: number; isActive: boolean }[];
    toJSON(): { meta: any; data: Result[] };
}
