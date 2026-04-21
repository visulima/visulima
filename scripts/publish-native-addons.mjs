#!/usr/bin/env node

/**
 * Publishes native binding platform packages before the main package.
 *
 * Called by @semantic-release/exec during the prepare phase with the resolved version.
 * This ensures all platform-specific packages are available on npm when users install
 * the main package and npm resolves optionalDependencies.
 *
 * Auth: @anolilab/semantic-release-pnpm's verifyConditions writes .npmrc into the
 * package root (context.cwd). We mirror its own publish.ts pattern and run
 * `pnpm publish <path>` from that same package root so pnpm picks up the .npmrc
 * naturally — no NPM_CONFIG_USERCONFIG juggling needed.
 *
 * Running pnpm directly from the npm/<platform>/ subdir does NOT work inside a
 * pnpm workspace: pnpm's auth lookup from a nested package dir can miss the
 * workspace-internal .npmrc and fall through to an unauthenticated default,
 * producing ENEEDAUTH.
 *
 * Run from the package directory (semantic-release does this automatically):
 *   node ../../../scripts/publish-native-addons.mjs <version>
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

const currentDir = process.cwd();
const version = process.argv[2];

if (!version) {
    console.error("Usage: node publish-native-addons.mjs <version>");
    process.exit(1);
}

let npmTag = "latest";

if (version.includes("-alpha.")) {
    npmTag = "alpha";
} else if (version.includes("-beta.")) {
    npmTag = "beta";
} else if (version.includes("-rc.")) {
    npmTag = "next";
}

const npmDir = join(currentDir, "npm");
const platformDirs = (await readdir(npmDir, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);

console.log(`Publishing native addons at version ${version} with tag ${npmTag}`);

for (const dir of platformDirs) {
    const platformPath = join(npmDir, dir);
    const pkgPath = join(platformPath, "package.json");
    let pkg;
    let originalVersion;

    try {
        pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        originalVersion = pkg.version;
    } catch {
        continue;
    }

    pkg.version = version;
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 4) + "\n");

    try {
        const output = execFileSync("pnpm", ["publish", platformPath, "--tag", npmTag, "--access", "public", "--no-git-checks"], {
            cwd: currentDir,
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
            pkg.version = originalVersion;
            writeFileSync(pkgPath, JSON.stringify(pkg, null, 4) + "\n");
            throw error;
        }
    }
}

console.log("All native addon packages published successfully");
