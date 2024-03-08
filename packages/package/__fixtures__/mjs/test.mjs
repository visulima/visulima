import { findPackageJson } from "@visulima/package";

const packageJson = await findPackageJson();

console.log(packageJson.path);
