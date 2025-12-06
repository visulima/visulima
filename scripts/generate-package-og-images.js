/**
 * This script generates SVG images for all packages using the package_og.jpg template
 * and inserts them into README.md files using a PLACEHOLDER.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, "..");

/**
 * Converts JPG image to base64 data URI
 * @param {string} imagePath - Path to the JPG image
 * @returns {string} Base64 data URI
 */
function imageToBase64(imagePath) {
    const imageBuffer = readFileSync(imagePath);
    return `data:image/jpeg;base64,${imageBuffer.toString("base64")}`;
}

/**
 * Escapes HTML entities in text
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

/**
 * Capitalizes the first letter of each word
 * @param {string} text - Text to capitalize
 * @returns {string} Capitalized text
 */
function capitalize(text) {
    return text
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
}

/**
 * Generates SVG with package name overlaid on the image
 * @param {string} packageName - Package name without @visulima/ prefix
 * @param {string} imageDataUri - Base64 data URI of the image
 * @returns {string} SVG string
 */
function generatePackageSVG(packageName, imageDataUri) {
    // Image dimensions from the JPG file (1660x512)
    const width = 1660;
    const height = 512;

    const textX = 65;
    const startY = 117;
    const lineHeight = 60; // Space between lines

    // Replace hyphens with spaces, split by spaces, and capitalize each word
    const nameParts = packageName
        .replace(/-/g, " ")
        .trim()
        .split(/\s+/)
        .map((word) => capitalize(word.trim()))
        .filter((word) => word.length > 0);

    // Escape each part for HTML
    const escapedParts = nameParts.map((part) => escapeHtml(part));

    // Generate tspan elements for each line
    const tspanElements = escapedParts.map((part, index) => `    <tspan x="${textX}" y="${startY + index * lineHeight}">${part}</tspan>`).join("\n");

    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <image href="${imageDataUri}" width="${width}" height="${height}" />
  <text
    font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    font-size="52"
    font-weight="700"
    fill="#ffffff"
    text-anchor="start"
    dominant-baseline="hanging"
    style="text-shadow: 0 2px 8px rgba(0,0,0,0.5), 0 0 2px rgba(0,0,0,0.3);"
  >
${tspanElements}
  </text>
</svg>`;
}

/**
 * Finds all packages with @visulima scope
 * @returns {Array<{name: string, path: string, packageName: string, description: string}>} Array of package info
 */
function findPackages() {
    const packages = [];
    const packagesDir = resolve(rootDir, "packages");

    function traverseDir(dir) {
        const entries = readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = join(dir, entry.name);

            if (entry.isDirectory()) {
                const packageJsonPath = join(fullPath, "package.json");
                if (existsSync(packageJsonPath)) {
                    try {
                        const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
                        if (packageJson.name && packageJson.name.startsWith("@visulima/")) {
                            const packageName = packageJson.name.replace("@visulima/", "");
                            packages.push({
                                name: packageJson.name,
                                path: fullPath,
                                packageName,
                                description: packageJson.description || "",
                            });
                        }
                    } catch (error) {
                        console.warn(`Failed to parse package.json at ${packageJsonPath}:`, error.message);
                    }
                } else {
                    // Continue traversing subdirectories
                    traverseDir(fullPath);
                }
            }
        }
    }

    traverseDir(packagesDir);
    return packages;
}

/**
 * Saves SVG to __assets__ folder
 * @param {string} packagePath - Path to package directory
 * @param {string} svg - SVG string to save
 * @returns {string} Relative path to the saved SVG file
 */
function saveSVGToAssets(packagePath, svg) {
    const assetsDir = join(packagePath, "__assets__");
    if (!existsSync(assetsDir)) {
        mkdirSync(assetsDir, { recursive: true });
    }

    const svgPath = join(assetsDir, "package-og.svg");
    writeFileSync(svgPath, svg, "utf-8");
    return "__assets__/package-og.svg";
}

/**
 * Inserts SVG link into README.md file and replaces name/description section
 * @param {string} readmePath - Path to README.md
 * @param {string} svgPath - Relative path to SVG file
 * @param {string} packageName - Package name without @visulima/ prefix
 * @param {string} packageDescription - Package description from package.json
 * @param {string} startPlaceholder - Start placeholder pattern
 * @param {string} endPlaceholder - End placeholder pattern
 * @param {boolean} addPlaceholderIfMissing - Whether to add placeholder if it doesn't exist
 * @returns {boolean} True if file was updated, false otherwise
 */
function insertSVGIntoReadme(
    readmePath,
    svgPath,
    packageName,
    packageDescription,
    startPlaceholder = "<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->",
    endPlaceholder = "<!-- END_PACKAGE_OG_IMAGE_PLACEHOLDER -->",
    addPlaceholderIfMissing = false,
) {
    if (!existsSync(readmePath)) {
        console.warn(`README.md not found at ${readmePath}`);
        return false;
    }

    let content = readFileSync(readmePath, "utf-8");

    // Check if placeholders exist
    const hasStartPlaceholder = content.includes(startPlaceholder);
    const hasEndPlaceholder = content.includes(endPlaceholder);

    if (!hasStartPlaceholder || !hasEndPlaceholder) {
        if (addPlaceholderIfMissing) {
            // Find and replace the existing name/description section
            const nameDescriptionPattern = /<div align="center">\s*<h3>.*?<\/h3>\s*<p>[\s\S]*?<\/p>\s*<\/div>/;
            const replacement = `${startPlaceholder} ${endPlaceholder}`;

            if (nameDescriptionPattern.test(content)) {
                content = content.replace(nameDescriptionPattern, replacement);
            } else {
                // Insert at the beginning if pattern not found
                content = `${startPlaceholder} ${endPlaceholder}\n\n${content}`;
            }
        } else {
            console.warn(`Placeholders not found in ${readmePath}. Skipping...`);
            return false;
        }
    }

    // Create the image link HTML
    const imageLink = `<a href="https://www.anolilab.com/open-source" align="center">\n\n  <img src="${svgPath}" alt="${packageName}" />\n\n</a>\n\n<h3 align="center">${packageDescription}</h3>`;

    // Replace content between placeholders (including empty content or same-line placeholders)
    const escapedStart = startPlaceholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const escapedEnd = endPlaceholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Try to find and replace content between placeholders
    const startIndex = content.indexOf(startPlaceholder);
    const endIndex = content.indexOf(endPlaceholder);

    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        // Extract the part before start placeholder, between placeholders, and after end placeholder
        const before = content.slice(0, startIndex);
        const between = content.slice(startIndex + startPlaceholder.length, endIndex);
        const after = content.slice(endIndex + endPlaceholder.length);

        // Replace the content between placeholders
        content = `${before}${startPlaceholder}\n\n${imageLink}\n\n${endPlaceholder}${after}`;
    } else {
        console.warn(`Could not find valid placeholder pair in ${readmePath}`);
        return false;
    }

    writeFileSync(readmePath, content, "utf-8");
    return true;
}

/**
 * Main function
 */
async function run() {
    console.info("Generating package OG images...");

    // Load the base image
    const imagePath = resolve(rootDir, ".github", "assets", "package_og.jpg");
    if (!existsSync(imagePath)) {
        throw new Error(`Image not found at ${imagePath}`);
    }

    const imageDataUri = imageToBase64(imagePath);
    console.info("Loaded base image");

    // Find all packages
    const packages = findPackages();
    console.info(`Found ${packages.length} packages`);

    let updated = 0;
    let skipped = 0;

    // Generate SVG for each package and insert into README
    // Set to true to automatically add placeholder if missing, false to skip files without placeholder
    const addPlaceholderIfMissing = process.env.AUTO_ADD_PLACEHOLDER === "true";

    for (const pkg of packages) {
        const readmePath = join(pkg.path, "README.md");
        const svg = generatePackageSVG(pkg.packageName, imageDataUri);

        // Save SVG to __assets__ folder
        const svgPath = saveSVGToAssets(pkg.path, svg);

        if (insertSVGIntoReadme(readmePath, svgPath, pkg.packageName, pkg.description, undefined, undefined, addPlaceholderIfMissing)) {
            console.info(`✓ Updated ${pkg.name}`);
            updated++;
        } else {
            skipped++;
        }
    }

    console.info(`\nCompleted! Updated ${updated} README files, skipped ${skipped} files.`);
}

try {
    run().then(() => {
        process.exit(0);
    });
} catch (error) {
    console.error("Error generating package OG images:", error);
    process.exit(1);
}
