// eslint-disable-next-line unicorn/prefer-module
const { walk } = require("@visulima/readdir");
// eslint-disable-next-line unicorn/prefer-module
const yargs = require("yargs/yargs");
// eslint-disable-next-line unicorn/prefer-module
const { hideBin } = require("yargs/helpers");
// eslint-disable-next-line unicorn/prefer-module
const fs = require("node:fs");
// eslint-disable-next-line unicorn/prefer-module
const fse = require("fs-extra");
// eslint-disable-next-line unicorn/prefer-module
const path = require("node:path");
// eslint-disable-next-line unicorn/prefer-module
const process = require("node:process");

const symlinkDir = require("symlink-dir");

// eslint-disable-next-line no-undef,unicorn/prefer-module
const docsPath = path.join(__dirname, "..", "pages", "docs");
// eslint-disable-next-line no-undef,unicorn/prefer-module
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

const { symlink, copy, path: pathOption } = argv;

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

async function command() {
    const searchPath = path.join(process.cwd(), pathOption);

    // eslint-disable-next-line no-console
    console.log("Searching for docs in", searchPath);
    // eslint-disable-next-line no-console
    console.log("");

    const paths = [];

    // eslint-disable-next-line no-restricted-syntax
    for await (const result of walk(searchPath, {
        maxDepth: 20,
        includeFiles: true,
        includeDirs: true,
        followSymlinks: false,
        extensions: [".mdx", ".md", ".json", ".apng", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico", ".pdf", ".avif", ".mp4", ".webm", ".mov"],
        skip: ["../**/.git/**", "../**/node_modules/**", "**/.git/**", "**/node_modules/**"],
    })) {
        if (result.isFile && result.path.includes("/__docs__/")) {
            // eslint-disable-next-line no-console
            console.log("Found", result.path);

            const relativePath = result.path.replace(searchPath, "").replace("__docs__/", "");

            paths.push({
                src: result.path,
                dest: `${docsPath}${relativePath}`,
                packageName: relativePath.split("/")[1]
            });
        } else if (result.isFile && result.path.includes("/__assets__/")) {
            // eslint-disable-next-line no-console
            console.log("Found", result.path);

            const relativePath = result.path.replace(searchPath, "").replace("__assets__/", "");

            paths.push({
                src: result.path,
                dest: `${assetsPath}${relativePath}`,
                packageName: relativePath.split("/")[1]
            });
        }
    }

    // delete old docs
    paths.forEach(({ packageName }) => {
        if (fs.existsSync(`${assetsPath}/${packageName}`)) {
            fse.removeSync(`${assetsPath}/${packageName}`,);
        }

        if (fs.existsSync(`${docsPath}/${packageName}`)) {
            fse.removeSync(`${docsPath}/${packageName}`,);
        }
    });

    if (copy) {
        paths.forEach(({ src, dest }) => {
            fse.copySync(src, dest);
        });
    } else if (symlink) {
        const symlinkPaths = {};

        paths.forEach(({ src, dest }) => {
            const splitPath = dest.replace(path.join(__dirname, "..") + "/", "").split("/");
            const srcSplitFolderName = splitPath[0] === "public" ? "__assets__" : "__docs__";

            const key = `${splitPath[0]}/${splitPath[1]}/${splitPath[2]}`;

            if (!symlinkPaths[key]) {
                symlinkPaths[key] = {
                    src: `${src.split(srcSplitFolderName)[0]}${srcSplitFolderName}`,
                    dest: path.join(__dirname, "..", key),
                };
            }
        });

        for await (const result of Object.values(symlinkPaths)) {
            await symlinkDir(result.src, result.dest);
        }
    }
}

// eslint-disable-next-line unicorn/prefer-top-level-await
command().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
});
