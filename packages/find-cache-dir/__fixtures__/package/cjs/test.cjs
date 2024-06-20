const { findCacheDirectorySync } = require("@visulima/find-cache-dir");

const cache = findCacheDirectorySync();

console.log(cache);
