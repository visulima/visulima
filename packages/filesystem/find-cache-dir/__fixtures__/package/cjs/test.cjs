const { findCacheDirSync } = require("@visulima/find-cache-dir");

const cache = findCacheDirSync();

console.log(cache);
