/**
 * This script is used to generate the `.github/labeler.yml` file.
 *
 * Modified copy of https://github.com/TanStack/router/blob/main/scripts/generateLabelerConfig.mjs
 *
 * MIT License
 * Copyright (c) 2021-present Tanner Linsley
 */

import { readdirSync, existsSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";

function generateLabelerConfig() {
    const ignored = [".DS_Store"];

    /**
     * Pairs of package labels and their corresponding paths
     * @type {Array<[string, string]>}
     **/
    const pairs = [];

    // Add subfolders in the packages folder, i.e. packages/**
    readdirSync(resolve("packages"))
        .filter((folder) => !ignored.includes(folder))
        .forEach((folder) => {
            // Check if package.json exists for the folder before adding it
            if (existsSync(resolve(join("packages", folder, "package.json")))) {
                pairs.push([`package: ${folder}`, `packages/${folder}/**/*`]);
            } else {
                console.log(`Skipping \`${folder}\` as it does not have a \`package.json\` file.`);
            }
        });

    // Convert the pairs into valid yaml
    const labelerConfigYamlStr = pairs
        .map(([packageLabel, packagePath]) => {
            let result = `"${packageLabel}":` + "\n" + `    - "${packagePath}"`;
            return result;
        })
        .join("\n");

    // Write to '.github/labeler.yml'
    const labelerConfigPath = resolve(".github/labeler.yml");

    writeFileSync(labelerConfigPath, labelerConfigYamlStr + "\n", {
        encoding: "utf-8",
    });
}

generateLabelerConfig();

process.exit(0);
