import type { CSSImports } from "icss-utils";
import type { ProcessOptions } from "postcss";
import type Processor from "postcss/lib/processor";

import type { Load } from "./load";

export default async function (
    icssImports: CSSImports,
    load: Load,
    file: string,
    extensions: string[],
    processor: Processor,
    options?: ProcessOptions,
): Promise<Record<string, string>> {
    const imports: Record<string, string> = {};

    for await (const [url, values] of Object.entries(icssImports)) {
        const exports = await load(url, file, extensions, processor, options);

        for (const [k, v] of Object.entries(values)) {
            imports[k] = exports[v];
        }
    }

    return imports;
}
