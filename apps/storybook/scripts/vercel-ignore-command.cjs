const { execSync } = require("node:child_process");
const { env, exit } = require("node:process");

const getChangedFiles = (extension = "") => {
    const extensionFilter = extension ? ` -- '***.${extension}'` : "";
    const command = `git diff HEAD^ HEAD --name-only${extensionFilter}`;
    const diffOutput = execSync(command);

    return diffOutput.toString().split("\n").filter(Boolean);
};

// Skip builds triggered by dependabot
if (env.VERCEL_GIT_COMMIT_AUTHOR_LOGIN === "dependabot[bot]") {
    // eslint-disable-next-line no-console
    console.log("Build triggered by dependabot, skipping");
    exit(0);
}

// Skip builds if the commit message starts with [skip ci]
if (env.VERCEL_GIT_COMMIT_MESSAGE?.startsWith("[skip ci]")) {
    // eslint-disable-next-line no-console
    console.log("Build triggered by [skip ci] commit message, skipping");
    exit(0);
}

// Skip builds if no files changed happened in required directories or files
const requiredChanges = [".storybook/", "__stories__/", "visulima/package.json"];

const changedFiles = getChangedFiles().filter((file) => {
    let changed = false;

    requiredChanges.forEach((directory) => {
        if (file.includes(directory)) {
            changed = true;
        }
    });

    return changed;
});

if (changedFiles.length === 0) {
    // eslint-disable-next-line no-console
    console.log("No files changed, skipping");
    exit(0);
}

// eslint-disable-next-line no-console
console.log("Build can be processed");
exit(1);
