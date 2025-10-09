import { match } from "path-to-regexp";

const filePathUrlMatcher = match<PathMatch>(["/:uuid", "/*path/:uuid.:ext/:metadata", "/*path/:uuid/:metadata", "/*path/:uuid.:ext", "/*path/:uuid"], {
    decode: decodeURIComponent,
});

export type PathMatch = { ext?: string; metadata?: string; path?: string[]; uuid: string };

export default filePathUrlMatcher;
