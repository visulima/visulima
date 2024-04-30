import { readFile } from "@visulima/fs";
import qs from "query-string";

import { resolveAsync } from "../../../utils/resolve";

/** File resolved by URL resolver */
export interface UrlFile {
    /** Absolute path to file */
    from: string;
    /** File source */
    source: Uint8Array;
    /** Original query extracted from the input path */
    urlQuery?: string;
}

/** URL resolver */
export type UrlResolve = (inputUrl: string, basedir: string) => Promise<UrlFile>;

const resolve: UrlResolve = async (inputUrl, basedir) => {
    const options = { basedirs: [basedir], caller: "URL resolver" };
    const parseOptions = { decode: false, parseFragmentIdentifier: true, sort: false as const };
    const { fragmentIdentifier, query, url } = qs.parseUrl(inputUrl, parseOptions);
    const from = await resolveAsync([url, `./${url}`], options);
    const urlQuery = qs.stringifyUrl({ fragmentIdentifier, query, url: "" }, parseOptions);

    return { from, source: await readFile(from), urlQuery };
};

export default resolve;
