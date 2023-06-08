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

// eslint-disable-next-line no-undef, unicorn/prefer-module
const packagesPath = path.join(__dirname, "..", "pages", "docs");
const publicPath = path.join(__dirname, "..", "public", "assets");

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

    // eslint-disable-next-line no-restricted-syntax
    for await (const result of walk(searchPath, {
        maxDepth: 20,
        includeFiles: true,
        includeDirs: true,
        followSymlinks: false,
        extensions: [".mdx", ".md", ".json", ".apng", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico", ".pdf", ".avif", ".mp4", ".webm", ".mov"],
        skip: ["../**/.git/**", "../**/node_modules/**", "**/.git/**", "**/node_modules/**"],
    })) {
        if (result.isFile && result.path.includes("/docs/")) {
            // eslint-disable-next-line no-console
            console.log("Found", result.path);

            let destination = `${packagesPath}${result.path.replace(searchPath, "").replace("docs/", "")}`;

            if (result.path.includes("docs/assets/")) {
                destination = `${publicPath}${result.path.replace(searchPath, "").replace("docs/assets", "")}`;
            }

            if (copy) {
                fs.rmSync(destination, { force: true });
                fse.copySync(result.path, destination);
            } else if (symlink) {
                // eslint-disable-next-line no-console
                throw new Error("TODO: add symlink logic");
            }
        }
    }
}

// eslint-disable-next-line unicorn/prefer-top-level-await
command().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
});
