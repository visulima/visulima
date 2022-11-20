// eslint-disable-next-line unicorn/prevent-abbreviations
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

// eslint-disable-next-line no-undef, unicorn/prefer-module
const packagesPath = path.join(__dirname, "..", "pages", "docs", "packages");

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
    process.exit(1);
}

if (typeof pathOption !== "string") {
    // eslint-disable-next-line no-console
    console.error("Please specify a path on --path");
    process.exit(1);
}

async function command() {
    const searchPath = path.join(process.cwd(), pathOption);

    fs.rmSync(packagesPath, { recursive: true, force: true });

    // eslint-disable-next-line no-console
    console.log("Searching for docs in", searchPath);
    // eslint-disable-next-line no-console
    console.log("");

    for await (const result of walk(searchPath, {
        maxDepth: 20,
        includeFiles: true,
        includeDirs: true,
        followSymlinks: false,
        extensions: [".mdx"],
        skip: ["../**/.git/**", "../**/node_modules/**", "**/.git/**", "**/node_modules/**"],
    })) {
        // eslint-disable-next-line no-console
        console.log("Found", result.path);

        if (result.isFile && result.path.includes("/docs/")) {
            const destination = `${packagesPath}${result.path.replace(searchPath, "").replace("docs/", "")}`;

            if (copy) {
                fse.copySync(result.path, destination);
            } else if (symlink) {
                // eslint-disable-next-line no-console
                console.log("TODO: add symlink logic");
            }
        }
    }
}

await command();
