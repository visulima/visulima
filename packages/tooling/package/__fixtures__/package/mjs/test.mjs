import { findPackageJsonSync } from "@visulima/package";

const packageJson = findPackageJsonSync();

console.log(JSON.stringify({
    path: packageJson.path,
    name: packageJson.packageJson.name
}));

