 
import { parse } from "yaml";

import readFileSync from "./read-file-sync";
import type { ReadFileOptions } from "./types";

const readYamlSync = <R = Record<string, unknown>>(path: URL | string, options?: ReadFileOptions<"brotli" | "gzip" | "none">): R => {
    const content = readFileSync(path, { encoding: "utf8", ...options });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return parse(content) as R;
};

export default readYamlSync;
