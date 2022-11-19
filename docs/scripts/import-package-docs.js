const { walk } = require("@visulima/readdir");
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const fs = require("node:fs");
const fse = require("fs-extra");
const path = require("node:path");

const packagesPath =  path.join(__dirname, "..", "pages", "packages");

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
    console.error("Please specify either --symlink or --copy");
    process.exit(1);
}

if (typeof pathOption !== "string") {
    console.error("Please specify a path on --path");
    process.exit(1);
}

async function command() {
    const searchPath = path.join(process.cwd(), pathOption);

    fs.rmSync(packagesPath, { recursive: true, force: true });

    console.log("Searching for docs in", searchPath);
    console.log("");

    for await (const result of walk(searchPath, {
        maxDepth: 20,
        includeFiles: true,
        includeDirs: true,
        followSymlinks: false,
        extensions: [".mdx"],
        skip: ["../**/.git/**", "../**/node_modules/**", "**/.git/**", "**/node_modules/**"],
    })) {
        console.log("Found", result.path);

        if (result.isFile && result.path.includes("/docs/")) {
            const dest = `${packagesPath}${result.path.replace(searchPath, "").replace("docs/", "")}`;

            if (copy) {
                fse.copySync(result.path, dest);
            } else if (symlink) {
                console.log("TODO: add symlink logic")
            }
        }
    }
}

command();
