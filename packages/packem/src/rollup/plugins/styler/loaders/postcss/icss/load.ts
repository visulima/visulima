import path from "node:path";

import { readFile } from "@visulima/fs";
import type { ProcessOptions } from "postcss";
import type Processor from "postcss/lib/processor";

import { resolveAsync } from "../../../utils/resolve";

export type Load = (url: string, file: string, extensions: string[], processor: Processor, options?: ProcessOptions) => Promise<Record<string, string>>;

const load: Load = async (url, file, extensions, processor, options_) => {
    const options = { basedirs: [path.dirname(file)], caller: "ICSS loader", extensions };
    const from = await resolveAsync([url, `./${url}`], options);
    const source = await readFile(from);
    const { messages } = await processor.process(source, { ...options_, from });

    const exports: Record<string, string> = {};

    for (const message of messages) {
        if (message.type !== "icss") {
            continue;
        }

        Object.assign(exports, message.export as Record<string, string>);
    }

    return exports;
};

export default load;
