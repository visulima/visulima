import Paginator from "./paginator";
import type { SimplePaginator } from "./types";

export type { SimplePaginator } from "./types.d";
export { default as Paginator } from "./paginator";

// eslint-disable-next-line max-len
export const paginate = <Result>(page: number, perPage: number, total: number, rows: Result[]): SimplePaginator<Result> => new Paginator(total, Number(perPage), Number(page), ...rows);
