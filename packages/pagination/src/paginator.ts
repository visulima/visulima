import qs from "qs";

import type { Paginator as IPaginator } from "./types";

/**
 * Simple paginator works with the data set provided by the standard
 * `offset` and `limit` based pagination.
 */
export default class Paginator<T = any> extends Array implements IPaginator<T> {
    private qs: { [key: string]: any } = {};

    private url: string = "/";

    private readonly rows: any[];

    /**
     * The first page is always 1
     */
    public readonly firstPage: number = 1;

    /**
     * Find if results set is empty or not
     */
    public readonly isEmpty: boolean;

    constructor(private readonly totalNumber: number, public readonly perPage: number, public currentPage: number, ...rows: any[]) {
        super(...rows);

        this.totalNumber = Number(totalNumber);

        this.rows = rows;
        this.isEmpty = this.rows.length === 0;
    }

    /**
     * Find if there are total records or not. This is not same as
     * `isEmpty`.
     *
     * The `isEmpty` reports about the current set of results. However, `hasTotal`
     * reports about the total number of records, regardless of the current.
     */
    get hasTotal(): boolean {
        return this.total > 0;
    }

    /**
     * Find if there are more pages to come
     */
    get hasMorePages(): boolean {
        return this.lastPage > this.currentPage;
    }

    /**
     * Find if there are enough results to be paginated or not
     */
    get hasPages(): boolean {
        return this.lastPage !== 1;
    }

    /**
     * The Last page number
     */
    get lastPage(): number {
        return Math.max(Math.ceil(this.total / this.perPage), 1);
    }

    /**
     * Casting `total` to a number. Later, we can think of situations
     * to cast it to a bigint
     */
    get total(): number {
        return Number(this.totalNumber);
    }

    /**
     * A reference to the result rows
     */
    public all() {
        return this.rows;
    }

    /**
     * Returns JSON meta data
     */
    public getMeta() {
        return {
            total: this.total,
            perPage: this.perPage,
            page: this.currentPage,
            lastPage: this.lastPage,
            firstPage: this.firstPage,
            firstPageUrl: this.getUrl(1),
            lastPageUrl: this.getUrl(this.lastPage),
            nextPageUrl: this.getNextPageUrl(),
            previousPageUrl: this.getPreviousPageUrl(),
        };
    }

    /**
     * Returns JSON representation of the paginated
     * data
     */
    public toJSON() {
        return {
            meta: this.getMeta(),
            data: this.all(),
        };
    }

    /**
     * Define query string to be appended to the pagination links
     */
    public queryString(values: { [key: string]: any }): this {
        this.qs = values;

        return this;
    }

    /**
     * Define base url for making the pagination links
     */
    public baseUrl(url: string): this {
        this.url = url;

        return this;
    }

    /**
     * Returns url for a given page. Doesn't validate the integrity of the
     * page
     */
    public getUrl(page: number): string {
        const qstring = qs.stringify({ ...this.qs, page: page < 1 ? 1 : page });

        return `${this.url}?${qstring}`;
    }

    /**
     * Returns url for the next page
     */
    public getNextPageUrl(): string | null {
        if (this.hasMorePages) {
            return this.getUrl(this.currentPage + 1);
        }

        return null;
    }

    /**
     * Returns URL for the previous page
     */
    public getPreviousPageUrl(): string | null {
        if (this.currentPage > 1) {
            return this.getUrl(this.currentPage - 1);
        }

        return null;
    }

    /**
     * Returns an array of urls under a given range
     */
    public getUrlsForRange(start: number, end: number) {
        const urls: { url: string; page: number; isActive: boolean }[] = [];

        // eslint-disable-next-line no-plusplus
        for (let index = start; index <= end; index++) {
            urls.push({ url: this.getUrl(index), page: index, isActive: index === this.currentPage });
        }

        return urls;
    }
}
