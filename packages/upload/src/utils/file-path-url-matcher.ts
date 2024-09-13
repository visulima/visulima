import { match } from "path-to-regexp";

const filePathUrlMatcher = match<PathMatch>(["/(.*)/:uuid.:ext", "/(.*)/:uuid"], { decode: decodeURIComponent });

export interface PathMatch { ext?: string; uuid: string }

export default filePathUrlMatcher;
