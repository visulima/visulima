// eslint-disable-next-line no-secrets/no-secrets
/**
 * Modified copy of https://github.com/huozhi/bunchee/blob/3cb85160bbad3af229654cc09d6fcd67120fe8bd/src/lib/split-chunk.ts
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2018 these people -> https://github.com/huozhi/bunchee/graphs/contributors
 */
import type { CustomPluginOptions } from "rollup";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getModuleLayer = (moduleMeta: CustomPluginOptions): any => (moduleMeta.preserveDirectives || { directives: [] }).directives.map((d: string) => d.replace(/^use /, "")).find((d: string) => d !== "strict")

export default getModuleLayer;
