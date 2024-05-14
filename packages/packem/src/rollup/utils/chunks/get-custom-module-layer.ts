// eslint-disable-next-line no-secrets/no-secrets
/**
 * Modified copy of https://github.com/huozhi/bunchee/blob/3cb85160bbad3af229654cc09d6fcd67120fe8bd/src/lib/split-chunk.ts
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2018 these people -> https://github.com/huozhi/bunchee/graphs/contributors
 */
import { basename } from "@visulima/path";

import { DEFAULT_EXTENSIONS } from "../../../constants";

const getCustomModuleLayer = (moduleId: string): string | undefined => {
    const segments = basename(moduleId).split(".");

    if (segments.length >= 2) {
        const [layerSegment, extension] = segments.slice(-2);
        const baseName = segments[0];
        const match = /^(\w+)-runtime$/.exec((layerSegment as string));
        const layer = match?.[1];

        if (DEFAULT_EXTENSIONS.includes(extension as string) && layer && layer.length > 0) {
            return baseName + "-" + layer;
        }
    }

    return undefined;
};

export default getCustomModuleLayer;
