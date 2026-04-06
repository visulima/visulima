#!/usr/bin/env node

/**
 * Publishes native binding platform packages before the main package.
 *
 * Called by @semantic-release/exec during the prepare phase with the resolved version.
 * This ensures all platform-specific packages are available on npm when users install
 * the main package and npm resolves optionalDependencies.
 *
 * Run from the package directory (semantic-release does this automatically):
 *   node ../../../scripts/publish-native-addons.mjs <version>
 */

import { execFileSync } from "node:child_process";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

const currentDir = process.cwd();
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

const platformDirs = (await readdir(npmDir, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);

console.log(`Publishing native addons at version ${version} with tag ${npmTag}`);

const npmrcPath = join(npmDir, ".npmrc");

// Write .npmrc with npm's own env-var syntax (not a JS template literal —
// npm expands ${NPM_TOKEN} at publish time from the environment).
writeFileSync(npmrcPath, "//registry.npmjs.org/:_authToken=${NPM_TOKEN}\n");

try {
    for (const dir of platformDirs) {
        const pkgPath = join(npmDir, dir, "package.json");
        let pkg;
        let originalVersion;

        try {
            pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
            originalVersion = pkg.version;
        } catch {
            continue;
        }

        // Update version to match the main package
        pkg.version = version;
        writeFileSync(pkgPath, JSON.stringify(pkg, null, 4) + "\n");

        try {
            const output = execFileSync("npm", ["publish", "--tag", npmTag, "--access", "public", "--provenance"], {
                cwd: join(npmDir, dir),
                encoding: "utf-8",
                env: process.env,
                stdio: "pipe",
            });

            console.log(output.trimEnd());
            console.log(`Published ${pkg.name}@${version}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);

            if (message.includes("You cannot publish over the previously published versions")) {
                console.warn(`${pkg.name}@${version} already published, skipping`);
            } else {
                // Restore original version before re-throwing so the working tree stays clean
                pkg.version = originalVersion;
                writeFileSync(pkgPath, JSON.stringify(pkg, null, 4) + "\n");
                throw error;
            }
        }
    }
} finally {
    // Always clean up the .npmrc containing the auth token
    try {
        unlinkSync(npmrcPath);
    } catch {
        // ignore
    }
}

console.log("All native addon packages published successfully");
