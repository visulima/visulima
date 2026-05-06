// This tool is used by the pr ci to determine the packages that need to be published to the pkg-pr-new registry.

// @ts-check
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { env, exit } from "node:process";

// Prefer reading the file list from disk (CHANGED_FILES_PATH) to avoid the
// argv+envp size limit on long-running branches; fall back to CHANGED_FILES
// for backwards compatibility.
let changedFiles = "";

if (env.CHANGED_FILES_PATH && existsSync(env.CHANGED_FILES_PATH)) {
    changedFiles = readFileSync(env.CHANGED_FILES_PATH, "utf8").trim().replace(/\\/g, "/");
} else if (env.CHANGED_FILES) {
    changedFiles = env.CHANGED_FILES;
}

if (!changedFiles) {
    console.log("No changed files found");

    exit(0);
}

const json = execSync(
    `pnpm exec nx show projects --affected --exclude=*-bench,docs,storybook,shared-utils --files=${changedFiles} --json`,
).toString("utf8");

/** @type {string[]} */
const affectedProjects = JSON.parse(json);

// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootPath = join(__dirname, "..");

const packages = affectedProjects.map((projectName) => {
    // Ask NX for the actual project root, since project names may not match directory paths
    const projectJson = JSON.parse(execSync(`pnpm exec nx show project ${projectName} --json`, { encoding: "utf8" }));
    const projectRoot = join(rootPath, projectJson.root);
    const packageJsonPath = join(projectRoot, "package.json");

    if (!existsSync(packageJsonPath)) {
        throw new Error(`package.json not found at ${packageJsonPath} (project: ${projectName})`);
    }

    return projectRoot;
});

if (packages.length > 0) {
    execSync(`pnpm exec pkg-pr-new publish --comment="update" --pnpm ${packages.join(" ")}`, { stdio: "inherit" });
} else {
    console.log("No packages to publish");
}
