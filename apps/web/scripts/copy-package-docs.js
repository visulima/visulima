#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, "..", "..", "..");
const PACKAGES_DIR = path.join(ROOT_DIR, "packages");
const DEST_DIR = path.join(__dirname, "..", "src", "content", "docs", "packages");

/**
 * Recursively copies a directory.
 */
async function copyDirectory(src, dest) {
    await fs.mkdir(dest, { recursive: true });

    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            await copyDirectory(srcPath, destPath);
        } else {
            await fs.copyFile(srcPath, destPath);
        }
    }
}

/**
 * Finds all packages with a docs/ directory and copies them
 * into apps/web/src/content/docs/packages/{package-name}/.
 */
async function main() {
    // Clean destination
    await fs.rm(DEST_DIR, { recursive: true, force: true });
    await fs.mkdir(DEST_DIR, { recursive: true });

    // Scan packages/{category}/{package}/docs
    const categories = await fs.readdir(PACKAGES_DIR, { withFileTypes: true });

    let copied = 0;

    for (const category of categories) {
        if (!category.isDirectory()) {
            continue;
        }

        const categoryPath = path.join(PACKAGES_DIR, category.name);
        const packages = await fs.readdir(categoryPath, { withFileTypes: true });

        for (const pkg of packages) {
            if (!pkg.isDirectory()) {
                continue;
            }

            const docsPath = path.join(categoryPath, pkg.name, "docs");

            try {
                const stat = await fs.stat(docsPath);

                if (!stat.isDirectory()) {
                    continue;
                }
            } catch {
                continue;
            }

            const destPath = path.join(DEST_DIR, pkg.name);

            await copyDirectory(docsPath, destPath);
            console.log(`  ${category.name}/${pkg.name}/docs → packages/${pkg.name}`);
            copied++;
        }
    }

    console.log(`\nCopied docs from ${copied} packages into src/content/docs/packages/`);
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
