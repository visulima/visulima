import { readFile } from "@visulima/fs";
import qs from "query-string";

import { resolveAsync } from "../../../utils/resolve";

/** File resolved by `@import` resolver */
export interface ImportFile {
    /** Absolute path to file */
    from: string;
    /** File source */
    source: Uint8Array;
}

/** `@import` resolver */
export type ImportResolve = (url: string, basedir: string, extensions: string[]) => Promise<ImportFile>;

const resolve: ImportResolve = async (inputUrl, basedir, extensions) => {
    const options = { basedirs: [basedir], caller: "@import resolver", extensions };
    const parseOptions = { decode: false, parseFragmentIdentifier: true, sort: false as const };
    const { url } = qs.parseUrl(inputUrl, parseOptions);
    const from = await resolveAsync([url, `./${url}`], options);

    return { from, source: await readFile(from) };
};

export default resolve;
