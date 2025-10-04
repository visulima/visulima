import { match } from "path-to-regexp";

const filePathUrlMatcher = match<PathMatch>(["/*path/:uuid.:ext", "/*path/:uuid"], { decode: decodeURIComponent });

export type PathMatch = { ext?: string; uuid: string };

export default filePathUrlMatcher;
