#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as prettier from "prettier";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packagesDir = join(__dirname, "..", "packages");

/**
 * Checks if a path contains a glob pattern
 */
function isGlobPattern(path) {
    return path.includes("*");
}

/**
 * Converts a dist glob pattern to a src glob pattern
 */
function convertGlobPattern(distPath) {
    // Convert dist path to src path
    let srcPath = distPath.replace(/^\.\/dist\//, "./src/");
    
    // Convert file extensions: .js -> .ts, .d.ts -> .ts
    srcPath = srcPath.replace(/\.(js|mjs|cjs)$/, ".ts");
    srcPath = srcPath.replace(/\.d\.ts$/, ".ts");
    srcPath = srcPath.replace(/\.d\.mts$/, ".mts");
    srcPath = srcPath.replace(/\.d\.cts$/, ".cts");
    
    return srcPath;
}

/**
 * Expands a glob pattern export into individual file exports
 * Example: "./language/*": "./src/language/*.ts" -> { "./language/en": "./src/language/en.ts", ... }
 */
function expandGlobExport(exportKey, globPath, packageDir) {
    // Extract directory and file pattern from glob
    // Pattern: "./src/language/*.ts" -> dir: "./src/language", pattern: "*.ts"
    const globMatch = globPath.match(/^(.+)\/([^/]*\*[^/]*)$/);
    if (!globMatch) {
        return {};
    }
    
    const [, dirPath, filePattern] = globMatch;
    const fullDirPath = join(packageDir, dirPath);
    
    if (!existsSync(fullDirPath) || !statSync(fullDirPath).isDirectory()) {
        return {};
    }
    
    // Extract the base path from export key (e.g., "./language/*" -> "./language")
    const exportBaseMatch = exportKey.match(/^(.+)\/\*$/);
    const exportBase = exportBaseMatch ? exportBaseMatch[1] : exportKey.replace(/\*$/, "");
    
    // Convert glob pattern to regex (simple case: *.ts -> /.*\.ts$/)
    // Escape dots first, then replace * with .*
    const patternRegex = new RegExp(
        "^" + filePattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$"
    );
    
    // Read directory and find matching files
    const files = readdirSync(fullDirPath, { withFileTypes: true })
        .filter((dirent) => dirent.isFile() && patternRegex.test(dirent.name))
        .map((dirent) => dirent.name);
    
    // Create individual exports
    const expandedExports = {};
    for (const file of files) {
        // Remove extension from file name for export key
        const fileBase = file.replace(/\.(ts|tsx|mts|cts)$/, "");
        const exportKeyPath = `${exportBase}/${fileBase}`;
        const sourcePath = `${dirPath}/${file}`;
        
        expandedExports[exportKeyPath] = sourcePath;
    }
    
    return expandedExports;
}

/**
 * Finds the actual source file for a dist path
 */
function findSourceFile(distPath, packageDir) {
    // Handle glob patterns
    if (isGlobPattern(distPath)) {
        return convertGlobPattern(distPath);
    }
    
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
 * Expands glob patterns into individual exports (JSR doesn't support globs)
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

            // Check if export key contains glob pattern
            const isGlobKey = isGlobPattern(key);

            if (typeof value === "string") {
                // Simple string export
                const sourcePath = findSourceFile(value, packageDir);
                if (isGlobKey && isGlobPattern(sourcePath)) {
                    // Expand glob pattern into individual exports
                    const expanded = expandGlobExport(key, sourcePath, packageDir);
                    Object.assign(jsrExports, expanded);
                } else {
                    jsrExports[key] = sourcePath;
                }
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
                    const sourcePath = findSourceFile(distPath, packageDir);
                    if (isGlobKey && isGlobPattern(sourcePath)) {
                        // Expand glob pattern into individual exports
                        const expanded = expandGlobExport(key, sourcePath, packageDir);
                        Object.assign(jsrExports, expanded);
                    } else {
                        jsrExports[key] = sourcePath;
                    }
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
async function generateJsrConfig(packageDir) {
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
        // Verify all export paths exist (glob patterns should already be expanded)
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
    
    // Format the generated file with prettier
    try {
        const prettierConfigPath = join(__dirname, "..", ".prettierrc.cjs");
        const prettierConfig = await prettier.resolveConfig(prettierConfigPath);
        const fileContent = readFileSync(jsrJsonPath, "utf-8");
        const formatted = await prettier.format(fileContent, {
            parser: "json",
            ...prettierConfig,
        });
        writeFileSync(jsrJsonPath, formatted, "utf-8");
    } catch (error) {
        // If prettier fails, continue anyway - the file was still created
        console.warn(`⚠️  Failed to format jsr.json for ${name} with prettier: ${error.message}`);
    }
    
    console.log(`✅ Created jsr.json for ${name}`);
    return true;
}

// Main execution
(async () => {
    const packageDirs = readdirSync(packagesDir, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => join(packagesDir, dirent.name));

    let successCount = 0;
    let failCount = 0;

    for (const packageDir of packageDirs) {
        if (await generateJsrConfig(packageDir)) {
            successCount++;
        } else {
            failCount++;
        }
    }

    console.log(`\n📊 Summary: ${successCount} packages processed successfully, ${failCount} failed`);
})();
