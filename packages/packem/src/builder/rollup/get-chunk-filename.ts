import type { PreRenderedChunk } from "rollup";

import type { BuildContext } from "../../types";

const getChunkFilename = (context: BuildContext, chunk: PreRenderedChunk, extension: string) => {
    if (chunk.isDynamicEntry) {
        return `chunks/[name].${extension}`;
    }
    // TODO: Find a way to generate human friendly hash for short groups
    return `shared/${context.options.name}.[hash].${extension}`;
};

export default getChunkFilename;
