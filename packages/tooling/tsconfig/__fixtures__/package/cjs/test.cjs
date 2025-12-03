const { findTsConfigSync } = require("@visulima/tsconfig");

const tsconfig = findTsConfigSync();

console.log(
    JSON.stringify({
        path: tsconfig.path,
        config: tsconfig.config,
    }),
);
