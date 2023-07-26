const { walk } = require("@visulima/readdir");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const fs = require("node:fs");
const fse = require("fs-extra");
const path = require("node:path");
const process = require("node:process");

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

const command = async function () {
    const searchPath = path.join(process.cwd(), pathOption);

    // eslint-disable-next-line no-console
    console.log("Searching for docs in", searchPath);
    // eslint-disable-next-line no-console
    console.log("");

    // eslint-disable-next-line no-restricted-syntax
    for await (const result of walk(searchPath, {
        extensions: [".mdx", ".md", ".json", ".apng", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico", ".pdf", ".avif", ".mp4", ".webm", ".mov"],
        followSymlinks: false,
        includeDirs: true,
        includeFiles: true,
        maxDepth: 20,
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
                throw new Error("TODO: add symlink logic");
            }
        }
    }
};

command().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
});
