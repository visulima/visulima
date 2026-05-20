// This tool is used by the pr ci to determine the packages that need to be published to the pkg-pr-new registry.

// @ts-check
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { exit } from "node:process";

// `nx affected` reads NX_BASE / NX_HEAD from the env (set by nrwl/nx-set-shas
// in the workflow). Don't pass --files=<huge list> — that hits the kernel
// argv size limit on long diffs.
const rawJson = execSync(`pnpm exec nx show projects --affected --exclude=*-bench,docs,storybook,shared-utils --json`).toString("utf8");

// pnpm prefixes stdout with `[WARN] Unsupported platform...` lines for
// native-binding optional packages on CI runners. nx prints its JSON on the
// last non-empty line, so walk the output bottom-up to find it.
const sliceJson = (raw) => {
    const lines = raw.split(/\r?\n/);

    for (let index = lines.length - 1; index >= 0; index--) {
        const line = lines[index].trim();

        if (line.length === 0) continue;
        if (line.startsWith("[\"") || line.startsWith("[]") || line.startsWith("{\"") || line.startsWith("{}")) {
            return line;
        }
    }

    throw new Error(`Expected JSON in command output, got:\n${raw}`);
};

/** @type {string[]} */
const affectedProjects = JSON.parse(sliceJson(rawJson));

// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootPath = join(__dirname, "..");

const packages = affectedProjects.map((projectName) => {
    // Ask NX for the actual project root, since project names may not match directory paths
    const projectJson = JSON.parse(sliceJson(execSync(`pnpm exec nx show project ${projectName} --json`, { encoding: "utf8" })));
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
