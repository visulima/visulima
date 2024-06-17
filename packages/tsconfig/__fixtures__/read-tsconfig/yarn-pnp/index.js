const { readTsConfig } = require("@visulima/package");

const tests = [
    () => readTsConfig("./tsconfig.package.json"),
    () => readTsConfig("./tsconfig.package-path.json"),
    () => readTsConfig("./tsconfig.package-path-directory.json"),
    () => readTsConfig("./tsconfig.org-package.json"),
    () => readTsConfig("./tsconfig.missing-extends.json"),
    () => readTsConfig("./tsconfig.invalid-extends.json"),
];

for (const test of tests) {
    try {
        console.log(test());
    } catch (error) {
        console.log("Error:", error.message);
        process.exitCode = 1;
    }
}
