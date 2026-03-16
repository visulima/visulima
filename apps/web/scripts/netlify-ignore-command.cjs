const { execFileSync } = require("node:child_process");
const { env, exit } = require("node:process");

const getChangedFiles = () => {
    let diffOutput;

    try {
        diffOutput = execFileSync("git", ["diff", "HEAD^", "HEAD", "--name-only"]);
    } catch {
        // Fallback for shallow clones or initial commits where HEAD^ doesn't exist
        diffOutput = execFileSync("git", ["show", "--name-only", "--pretty=", "HEAD"]);
    }

    return diffOutput.toString().split("\n").filter(Boolean);
};

const getCommitMessage = () => {
    return execFileSync("git", ["log", "-1", "--format=%s"]).toString().trim();
};

// Skip builds if the commit message starts with [skip ci]
const commitMessage = getCommitMessage();

if (commitMessage.startsWith("[skip ci]")) {
    // eslint-disable-next-line no-console
    console.log("Build triggered by [skip ci] commit message, skipping");
    exit(0);
}

// Only build when changes happen in relevant directories or files
const requiredChanges = [
    "apps/web/",
    "/docs/",
    "pnpm-lock.yaml",
];

const changedFiles = getChangedFiles();

// eslint-disable-next-line no-console
console.log(`Changed files (${changedFiles.length}):`);

for (const file of changedFiles) {
    // eslint-disable-next-line no-console
    console.log(`  ${file}`);
}

const relevantChanges = changedFiles.filter((file) => {
    return requiredChanges.some((pattern) => file.includes(pattern));
});

if (relevantChanges.length === 0) {
    // eslint-disable-next-line no-console
    console.log("No relevant changes detected, skipping build");
    exit(0);
}

// eslint-disable-next-line no-console
console.log(`Relevant changes detected (${relevantChanges.length}):`);

for (const file of relevantChanges) {
    // eslint-disable-next-line no-console
    console.log(`  ${file}`);
}

// eslint-disable-next-line no-console
console.log("Build can be processed");
exit(1);
