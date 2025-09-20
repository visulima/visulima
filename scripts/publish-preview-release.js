// This tool is used by the pr ci to determine the packages that need to be published to the pkg-pr-new registry.

// @ts-check
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { env, exit } from "node:process";

if (!env.CHANGED_FILES) {
    console.log("No changed files found");

    exit(0);
}

const json = execSync(`pnpm exec nx show projects --affected --exclude=*-bench,docs,storybook,shared-utils --files=${process.env.CHANGED_FILES} --json`).toString("utf8");

/** @type {Array<{ path: string, private: boolean, peerDependencies?: Record<string, string> }>} */
const affectedRepoPackages = JSON.parse(json);

// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
const __dirname = dirname(fileURLToPath(import.meta.url));
const packagesPath = join(__dirname, "..", "packages");

const packages = affectedRepoPackages.map((path) => {
    const packageJsonPath = join(packagesPath, path, "package.json");

    if (!existsSync(packageJsonPath)) {
        throw new Error(`package.json not found at ${packageJsonPath}`);
    }

    return join(packagesPath, path);
});

if (packages.length > 0) {
    execSync(`pnpm exec pkg-pr-new publish --comment="update" --pnpm ${packages.join(" ")}`, { stdio: "inherit" });
} else {
    console.log("No packages to publish");
}
