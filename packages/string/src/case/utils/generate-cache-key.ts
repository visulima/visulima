import type { CaseOptions } from "../types";

/**
 * Generates a fast cache key from the input string and relevant options.
 * This is optimized for speed using string concatenation which is highly optimized in V8.
 */
const generateCacheKey = (value: string, options?: CaseOptions & { joiner?: string }): string =>
    // Only include options that affect the output
    `${value}::${options?.joiner ?? ""}::${options?.locale ?? ""}::${options?.knownAcronyms?.join(",") ?? ""}::${options?.normalize ?? false}`;

export default generateCacheKey;
