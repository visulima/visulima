 
import { parse } from "yaml";

import readFile from "./read-file";
import type { ReadFileOptions } from "./types";

const readYaml = async <R = Record<string, unknown>>(path: URL | string, options?: ReadFileOptions<"brotli" | "gzip" | "none">): Promise<R> => {
    const content = await readFile(path, { encoding: "utf8", ...options });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return parse(content) as R;
};

export default readYaml;
