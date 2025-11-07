#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packagesDir = join(__dirname, "..", "packages");

/**
 * Finds the actual source file for a dist path
 */
function findSourceFile(distPath, packageDir) {
    // Convert dist path to potential src paths
    const basePath = distPath.replace(/^\.\/dist\//, "./src/");
    
    // Try different extensions
    const extensions = [".ts", ".tsx", ".mts", ".cts"];
    const baseWithoutExt = basePath.replace(/\.(js|mjs|cjs|d\.ts|d\.mts|d\.cts)$/, "");
    
    for (const ext of extensions) {
        const candidatePath = baseWithoutExt + ext;
        if (fileExists(join(packageDir, candidatePath))) {
            return candidatePath;
        }
    }
    
    // If no source file found, return the dist path as fallback
    return distPath;
}

/**
 * Converts package.json exports to jsr.json exports format
 * Maps dist paths to src paths for TypeScript source files
 */
function convertExports(packageExports, packageDir) {
    if (typeof packageExports === "string") {
        // Single export - find source file
        return findSourceFile(packageExports, packageDir);
    }

    if (typeof packageExports === "object" && packageExports !== null) {
        const jsrExports = {};

        for (const [key, value] of Object.entries(packageExports)) {
            // Skip package.json exports
            if (key === "./package.json") {
                continue;
            }

            if (typeof value === "string") {
                // Simple string export
                jsrExports[key] = findSourceFile(value, packageDir);
            } else if (typeof value === "object" && value !== null) {
                // Object with conditions (import, require, types, etc.)
                // For JSR, we want the import/default path, preferring TypeScript
                let distPath = null;
                
                if (value.import) {
                    distPath = typeof value.import === "string" 
                        ? value.import 
                        : value.import.default;
                } else if (value.default) {
                    distPath = value.default;
                } else if (value.types) {
                    distPath = value.types;
                } else {
                    // Use the first available path
                    const firstValue = Object.values(value)[0];
                    distPath = typeof firstValue === "string" 
                        ? firstValue 
                        : firstValue?.default || firstValue?.types;
                }
                
                if (distPath) {
                    jsrExports[key] = findSourceFile(distPath, packageDir);
                }
            }
        }

        return Object.keys(jsrExports).length > 0 ? jsrExports : undefined;
    }

    return undefined;
}

/**
 * Gets the main entry point from package.json exports
 */
function getMainExport(packageExports) {
    if (typeof packageExports === "string") {
        return packageExports;
    }

    if (typeof packageExports === "object" && packageExports !== null) {
        const mainExport = packageExports["."];
        if (!mainExport) {
            return undefined;
        }

        if (typeof mainExport === "string") {
            return mainExport;
        }

        // Get import or default
        if (mainExport.import) {
            return typeof mainExport.import === "string"
                ? mainExport.import
                : mainExport.import.default;
        }

        if (mainExport.default) {
            return mainExport.default;
        }

        // Fallback to types
        if (mainExport.types) {
            return mainExport.types;
        }
    }

    return undefined;
}

/**
 * Checks if a file exists
 */
function fileExists(filePath) {
    return existsSync(filePath);
}

/**
 * Generates jsr.json for a package
 */
function generateJsrConfig(packageDir) {
    const packageJsonPath = join(packageDir, "package.json");
    const jsrJsonPath = join(packageDir, "jsr.json");

    if (!existsSync(packageJsonPath)) {
        console.warn(`⚠️  No package.json found in ${packageDir}`);
        return false;
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    const { name, version, exports: packageExports } = packageJson;

    if (!name || !version) {
        console.warn(`⚠️  Missing name or version in ${packageJsonPath}`);
        return false;
    }

    // Convert exports
    let jsrExports = convertExports(packageExports, packageDir);

    // If no exports converted, try to use main entry point
    if (!jsrExports) {
        const mainExport = getMainExport(packageExports);
        if (mainExport) {
            jsrExports = findSourceFile(mainExport, packageDir);
        } else {
            // Default to src/index.ts if it exists, try other extensions
            const indexFiles = ["./src/index.ts", "./src/index.tsx", "./src/index.mts"];
            let foundIndex = false;
            for (const indexFile of indexFiles) {
                if (fileExists(join(packageDir, indexFile))) {
                    jsrExports = indexFile;
                    foundIndex = true;
                    break;
                }
            }
            if (!foundIndex) {
                console.warn(`⚠️  Could not determine exports for ${name}`);
                return false;
            }
        }
    } else {
        // Verify all export paths exist
        const verifiedExports = {};
        for (const [key, value] of Object.entries(jsrExports)) {
            const fullPath = join(packageDir, value);
            if (fileExists(fullPath)) {
                verifiedExports[key] = value;
            } else {
                console.warn(`⚠️  Export path ${value} does not exist for ${name}`);
                verifiedExports[key] = value; // Keep it anyway, might be created during build
            }
        }
        jsrExports = verifiedExports;
    }

    // Create jsr.json
    const jsrConfig = {
        name,
        version,
        exports: jsrExports,
    };

    writeFileSync(jsrJsonPath, JSON.stringify(jsrConfig, null, 2) + "\n", "utf-8");
    console.log(`✅ Created jsr.json for ${name}`);
    return true;
}

// Main execution
const packageDirs = readdirSync(packagesDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => join(packagesDir, dirent.name));

let successCount = 0;
let failCount = 0;

for (const packageDir of packageDirs) {
    if (generateJsrConfig(packageDir)) {
        successCount++;
    } else {
        failCount++;
    }
}

console.log(`\n📊 Summary: ${successCount} packages processed successfully, ${failCount} failed`);
