import { match } from "path-to-regexp";

const filePathUrlMatcher = match<PathMatch>(["/(.*)/:uuid.:ext", "/(.*)/:uuid"], { decode: decodeURIComponent });

export type PathMatch = { uuid: string, ext?: string };

export default filePathUrlMatcher;
