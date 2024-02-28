import { existsSync,readdirSync, readFileSync, statSync  } from "node:fs";
import { dirname,resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { brotli,generateFileSizeReport, gzip, raw } from "@jsenv/file-size-impact";

const currentDir = dirname(fileURLToPath(import.meta.url));
const packagesDir = resolve(currentDir, "..", "packages");
const manifestConfig = {};
const trackingConfig = {};

const dir = resolve(packagesDir);
const names = readdirSync(dir);

names.map((name) => {
    const p = resolve(dir, name);
    const stat = statSync(p);

    if (stat.isDirectory()) {
        const pj = resolve(p, "package.json");

        if (existsSync(pj) === false) {
            return;
        }

        const content = readFileSync(pj, "utf8");
        const packageName = JSON.parse(content).name;
        const path = resolve(p, "dist");

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

export const fileSizeReport = await generateFileSizeReport({
    log: process.argv.includes("--log"),
    manifestConfig,
    rootDirectoryUrl: new URL("../packages/", import.meta.url),
    trackingConfig,
    transformations: { brotli, gzip, raw },
});
