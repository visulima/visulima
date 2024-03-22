import { describe } from "vitest";
import { findCacheDirectory, findCacheDirectorySync } from "../../src";

describe.each([
    ["findCacheDirectory", findCacheDirectory],
    ["findCacheDirectorySync", findCacheDirectorySync],
])("%s", (name, function_) => {});
