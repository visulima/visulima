import { findCacheDirectorySync } from "@visulima/find-cache-dir";

const cache = findCacheDirectorySync();

console.log(cache);

