import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { walk } from "@visulima/readdir";

import yargs from "yargs/yargs";

import { hideBin } from "yargs/helpers";
import fse from "fs-extra";
// eslint-disable-next-line import/no-extraneous-dependencies
import symlinkDir from "symlink-dir";

// eslint-disable-next-line no-underscore-dangle
const __dirname = path.dirname(new URL(import.meta.url).pathname);

const documentationPath = path.join(__dirname, "..", "pages", "docs");
const assetsPath = path.join(__dirname, "..", "public", "assets");

const argv = yargs(hideBin(process.argv))
    .option("path", {
        description: "Path to search for the docs",
    })
    .option("symlink", {
        description: "symlink the found docs",
        type: "boolean",
    })
    .option("copy", {
        description: "copy the found docs",
        type: "boolean",
    })
    .help()
    .alias("help", "h")
    .parse();

const { copy, path: pathOption, symlink } = argv;

if ((!symlink && !copy) || (symlink && copy)) {
    // eslint-disable-next-line no-console
    console.error("Please specify either --symlink or --copy");
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(1);
}

if (typeof pathOption !== "string") {
    // eslint-disable-next-line no-console
    console.error("Please specify a path on --path");
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(1);
}

// eslint-disable-next-line sonarjs/cognitive-complexity
const command = async () => {
    const searchPath = path.join(process.cwd(), pathOption);

    // eslint-disable-next-line no-console
    console.log("Searching for docs in", searchPath);
    // eslint-disable-next-line no-console
    console.log("");

    const paths = [];

    // eslint-disable-next-line no-restricted-syntax
    for await (const result of walk(searchPath, {
        extensions: [".mdx", ".md", ".json", ".apng", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico", ".pdf", ".avif", ".mp4", ".webm", ".mov"],
        followSymlinks: false,
        includeDirs: true,
        includeFiles: true,
        maxDepth: 20,
        skip: ["../**/.git/**", "../**/node_modules/**", "**/.git/**", "**/node_modules/**"],
    })) {
        if (result.isFile && result.path.includes("/__docs__/")) {
            // eslint-disable-next-line no-console
            console.log("Found", result.path);

            const relativePath = result.path.replace(searchPath, "").replace("__docs__/", "");

            paths.push({
                dest: `${documentationPath}${relativePath}`,
                packageName: relativePath.split("/")[1],
                src: result.path,
            });
        } else if (result.isFile && result.path.includes("/__assets__/")) {
            // eslint-disable-next-line no-console
            console.log("Found", result.path);

            const relativePath = result.path.replace(searchPath, "").replace("__assets__/", "");

            paths.push({
                dest: `${assetsPath}${relativePath}`,
                packageName: relativePath.split("/")[1],
                src: result.path,
            });
        }
    }

    // delete old docs
    paths.forEach(({ packageName }) => {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        if (fs.existsSync(`${assetsPath}/${packageName}`)) {
            fse.removeSync(`${assetsPath}/${packageName}`);
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        if (fs.existsSync(`${documentationPath}/${packageName}`)) {
            fse.removeSync(`${documentationPath}/${packageName}`);
        }
    });

    if (copy) {
        paths.forEach(({ dest, src }) => {
            fse.copySync(src, dest);
        });
    } else if (symlink) {
        const symlinkPaths = {};

        paths.forEach(({ dest, src }) => {
            const splitPath = dest.replace(`${path.join(__dirname, "..")}/`, "").split("/");
            const sourceSplitFolderName = splitPath[0] === "public" ? "__assets__" : "__docs__";

            const key = `${splitPath[0]}/${splitPath[1]}/${splitPath[2]}`;

            // eslint-disable-next-line security/detect-object-injection
            if (!symlinkPaths[key]) {
                // eslint-disable-next-line security/detect-object-injection
                symlinkPaths[key] = {
                    dest: path.join(__dirname, "..", key),
                    src: `${src.split(sourceSplitFolderName)[0]}${sourceSplitFolderName}`,
                };
            }
        });

        // eslint-disable-next-line no-restricted-syntax
        for await (const result of Object.values(symlinkPaths)) {
            await symlinkDir(result.src, result.dest);
        }
    }
};

// eslint-disable-next-line unicorn/prefer-top-level-await
command().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
});
