/* eslint-disable no-console */
/* eslint-disable unicorn/no-process-exit */
let requiredVersion = require("fs").readFileSync(".nvmrc", { encoding: "utf8" }).trim();

if (!requiredVersion.includes("v")) {
    requiredVersion = `v${requiredVersion}`;
}

if (process.env.SKIP_CHECK !== undefined) {
    process.exit(0);
}

if (process.version.split(".")[0] !== requiredVersion.split(".")[0]) {
    console.error(`[!] This project requires Node.js ${requiredVersion}, current version is ${process.version}`);

    process.exit(1);
}
