import mainPackageJson from "@visulima/colorize/package.json" assert { type: "json" };

import packageJson from "./package.json" assert { type: "json" };

const packages = Object.fromEntries(Object.entries(packageJson.dependencies).map(([name, version]) => [name, `${name}@${version}`]));

packages["@visulima/colorize"] = `@visulima/colorize@${mainPackageJson.version}`;

export default packages;
