const { parseTsConfig } = require("@visulima/package");
const tests = [
    () => parseTsConfig("./tsconfig.package.json"),
    () => parseTsConfig("./tsconfig.package-path.json"),
    () => parseTsConfig("./tsconfig.package-path-directory.json"),
    () => parseTsConfig("./tsconfig.org-package.json"),
    () => parseTsConfig("./tsconfig.missing-extends.json"),
    () => parseTsConfig("./tsconfig.invalid-extends.json"),
];

for (const test of tests) {
    try {
        console.log(test());
    } catch (error) {
        console.log("Error:", error.message);
        process.exitCode = 1;
    }
}
