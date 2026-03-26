#!/usr/bin/env node

/**
 * Publishes native binding platform packages before the main @visulima/task-runner package.
 *
 * Called by @semantic-release/exec during the prepare phase with the resolved version.
 * This ensures all platform-specific packages are available on npm when users install
 * the main package and npm resolves optionalDependencies.
 *
 * Usage: node publish-native-addons.mjs <version>
 */

import { execFileSync } from "node:child_process";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const version = process.argv[2];

if (!version) {
    console.error("Usage: node publish-native-addons.mjs <version>");
    process.exit(1);
}

// Determine npm tag from version string
let npmTag = "latest";

if (version.includes("-alpha.")) {
    npmTag = "alpha";
} else if (version.includes("-beta.")) {
    npmTag = "beta";
} else if (version.includes("-rc.")) {
    npmTag = "next";
}

const npmDir = join(currentDir, "npm");

// Ensure npm auth is configured for publishing (CI environments)
const npmToken = process.env.NPM_TOKEN;

if (!npmToken) {
    console.error("NPM_TOKEN environment variable is required for publishing");
    process.exit(1);
}

// Write .npmrc in the npm/ directory so all platform package publishes inherit auth
writeFileSync(join(npmDir, ".npmrc"), "//registry.npmjs.org/:_authToken=${NPM_TOKEN}\n");

const platformDirs = (await readdir(npmDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

console.log(`Publishing native addons at version ${version} with tag ${npmTag}`);

for (const dir of platformDirs) {
    const pkgPath = join(npmDir, dir, "package.json");
    let pkg;

    try {
        pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    } catch {
        continue;
    }

    // Update version to match the main package
    pkg.version = version;
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 4) + "\n");

    try {
        const output = execFileSync("npm", ["publish", "--tag", npmTag, "--access", "public", "--provenance"], {
            cwd: join(npmDir, dir),
            env: process.env,
            stdio: "pipe",
        });

        process.stdout.write(output);
        console.log(`Published ${pkg.name}@${version}`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        if (message.includes("You cannot publish over the previously published versions")) {
            console.warn(`${pkg.name}@${version} already published, skipping`);
        } else {
            throw error;
        }
    }
}

// Clean up temporary .npmrc
try {
    unlinkSync(join(npmDir, ".npmrc"));
} catch {
    // ignore
}

console.log("All native addon packages published successfully");
