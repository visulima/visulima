import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { brotli, generateFileSizeReport, gzip, raw } from "@jsenv/file-size-impact";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const packagesDirectory = resolve(currentDirectory, "..", "packages");
const manifestConfig = {};
const trackingConfig = {};

const directory = resolve(packagesDirectory);
const names = readdirSync(directory);

names.forEach((name) => {
    const p = resolve(directory, name);
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const stat = statSync(p);

    if (stat.isDirectory()) {
        const pj = resolve(p, "package.json");

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        if (existsSync(pj) === false) {
            return;
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const content = readFileSync(pj, "utf8");
        const packageName = JSON.parse(content).name;
        const path = resolve(p, "dist");

        // eslint-disable-next-line security/detect-object-injection
        trackingConfig[packageName] = {
            [`${path}/*.cjs`]: true,
            [`${path}/*.css`]: true,
            [`${path}/*.dat`]: false,
            [`${path}/*.dll`]: false,
            [`${path}/*.gz`]: false,
            [`${path}/*.html`]: true,
            [`${path}/*.js`]: true,
            [`${path}/*.map`]: false,
            [`${path}/*.mjs`]: true,
            [`${path}/*.png`]: false,
            [`${path}/*.svg`]: false,
        };
    }
});

// eslint-disable-next-line import/no-unused-modules,import/prefer-default-export
export const fileSizeReport = await generateFileSizeReport({
    log: process.argv.includes("--log"),
    manifestConfig,
    // eslint-disable-next-line compat/compat
    rootDirectoryUrl: new URL("../packages/", import.meta.url),
    trackingConfig,
    transformations: { brotli, gzip, raw },
});
