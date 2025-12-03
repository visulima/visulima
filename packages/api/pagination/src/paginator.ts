// eslint-disable-next-line import/no-extraneous-dependencies
import { stringify } from "qs-esm";

import type { PaginationMeta, PaginationResult, Paginator as IPaginator } from "./types";

type UrlsForRange = { isActive: boolean; page: number; url: string }[];

/**
 * Simple paginator works with the data set provided by the standard
 * `offset` and `limit` based pagination.
 */
export default class Paginator<T = unknown> extends Array<T> implements IPaginator<T> {
    /**
     * The first page is always 1
     */
    public readonly firstPage: number = 1;

    /**
     * Find if results set is empty or not
     */
    public readonly isEmpty: boolean;

    private qs: Record<string, unknown> = {};

    private readonly rows: T[];

    private url = "/";

    public constructor(
        private readonly totalNumber: number,
        public readonly perPage: number,
        public currentPage: number,
        ...rows: T[]
    ) {
        super(...rows);

        this.totalNumber = Number(totalNumber);

        this.rows = rows;
        this.isEmpty = this.rows.length === 0;
    }

    /**
     * A reference to the result rows.
     */
    public all(): T[] {
        return this.rows;
    }

    /**
     * Define base url for making the pagination links.
     */
    public baseUrl(url: string): this {
        this.url = url;

        return this;
    }

    /**
     * Returns JSON meta data.
     */
    public getMeta(): PaginationMeta {
        return {
            firstPage: this.firstPage,
            firstPageUrl: this.getUrl(1),
            lastPage: this.lastPage,
            lastPageUrl: this.getUrl(this.lastPage),
            nextPageUrl: this.getNextPageUrl(),
            page: this.currentPage,
            perPage: this.perPage,
            previousPageUrl: this.getPreviousPageUrl(),
            total: this.total,
        };
    }

    /**
     * Returns url for the next page.
     */
    public getNextPageUrl(): string | null {
        if (this.hasMorePages) {
            return this.getUrl(this.currentPage + 1);
        }

        // eslint-disable-next-line unicorn/no-null
        return null;
    }

    /**
     * Returns URL for the previous page.
     */
    public getPreviousPageUrl(): string | null {
        if (this.currentPage > 1) {
            return this.getUrl(this.currentPage - 1);
        }

        // eslint-disable-next-line unicorn/no-null
        return null;
    }

    /**
     * Returns url for a given page. Doesn't validate the integrity of the
     * page.
     */
    public getUrl(page: number): string {
        const qstring = stringify({ ...this.qs, page: Math.max(page, 1) });

        return `${this.url}?${qstring}`;
    }

    /**
     * Returns an array of urls under a given range.
     */
    public getUrlsForRange(start: number, end: number): UrlsForRange {
        const urls: UrlsForRange = [];

        // eslint-disable-next-line no-plusplus
        for (let index = start; index <= end; index++) {
            urls.push({ isActive: index === this.currentPage, page: index, url: this.getUrl(index) });
        }

        return urls;
    }

    /**
     * Define query string to be appended to the pagination links.
     */
    public queryString(values: Record<string, unknown>): this {
        this.qs = values;

        return this;
    }

    /**
     * Returns JSON representation of the paginated data.
     */
    public toJSON(): PaginationResult<T> {
        return {
            data: this.all(),
            meta: this.getMeta(),
        };
    }

    /**
     * Find if there are more pages to come.
     */
    public get hasMorePages(): boolean {
        return this.lastPage > this.currentPage;
    }

    /**
     * Find if there are enough results to be paginated or not.
     */
    public get hasPages(): boolean {
        return this.lastPage !== 1;
    }

    /**
     * Find if there are total records or not. This is not same as
     * `isEmpty`.
     *
     * The `isEmpty` reports about the current set of results. However, `hasTotal`
     * reports about the total number of records, regardless of the current.
     */
    public get hasTotal(): boolean {
        return this.total > 0;
    }

    /**
     * The Last page number.
     */
    public get lastPage(): number {
        return Math.max(Math.ceil(this.total / this.perPage), 1);
    }

    /**
     * Casting `total` to a number. Later, we can think of situations
     * to cast it to a bigint.
     */
    public get total(): number {
        return Number(this.totalNumber);
    }
}
