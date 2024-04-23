import { fileURLToPath } from "node:url";

import { readFile } from "@visulima/fs";
import type { Plugin } from "rollup";

const resolverPrefix = "\0__file_url__";

const resolveFileUrl = (): Plugin => {
    return {
        async load(id) {
            if (id.startsWith(resolverPrefix)) {
                const path = fileURLToPath(id.slice(resolverPrefix.length));

                // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                return await readFile(path);
            }

            return undefined;
        },
        name: "packem:resolve-file-url",
        resolveId(id) {
            if (id.startsWith("file://")) {
                return `${resolverPrefix}${id}`;
            }

            return undefined;
        },
    };
};

export default resolveFileUrl;
