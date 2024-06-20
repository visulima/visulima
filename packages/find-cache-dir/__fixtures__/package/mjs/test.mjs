import { findCacheDirSync } from "@visulima/find-cache-dir";

const cache = findCacheDirSync();

console.log(cache);
