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
 * Sanitizes meta.json pages array to only contain strings,
 * since fumadocs-mdx does not support object entries.
 */
async function sanitizeMetaJson(filePath) {
    const content = await fs.readFile(filePath, "utf-8");
    const meta = JSON.parse(content);

    if (Array.isArray(meta.pages)) {
        meta.pages = meta.pages.filter((entry) => typeof entry === "string");
    }

    await fs.writeFile(filePath, JSON.stringify(meta, null, 2) + "\n");
}

/**
 * Ensures MDX files have valid frontmatter with a title,
 * and strips incompatible imports (e.g., nextra-theme-docs).
 */
async function sanitizeMdx(filePath) {
    let content = await fs.readFile(filePath, "utf-8");

    // 1. Strip import statements referencing unavailable modules
    content = content.replace(/^import\s+.*from\s+['"]@visulima\/nextra-theme-docs.*['"];?\s*$/gm, "");

    // 2. Strip corrupted LLM artifacts (fullwidth pipe characters, tool call markers)
    content = content.replace(/<｜[^｜]*｜>/g, "");

    // 3. Strip undefined JSX components from nextra-theme-docs FIRST (before escaping)
    const nextraComponents = "Callout|Tab|Tabs|Cards|Card|Steps|Step|FileTree|Bleed|Alert|CardGroup|Providers|QueryClientProvider";
    const wrapperRegex = new RegExp(`<(${nextraComponents})\\b[^>]*>([\\s\\S]*?)<\\/\\1>`, "g");
    const selfClosingRegex = new RegExp(`<(${nextraComponents})\\b[^>]*\\/>`, "g");

    for (let i = 0; i < 5; i++) {
        content = content.replace(wrapperRegex, "$2");
    }
    content = content.replace(selfClosingRegex, "");

    // 4. Escape ALL angle brackets outside code blocks that aren't standard HTML tags.
    // This prevents MDX from interpreting TypeScript generics, comparison operators,
    // and other non-HTML angle brackets as JSX.
    const codeBlockRegex = /(```[\s\S]*?```|`[^`]+`)/g;
    const parts = content.split(codeBlockRegex);

    const safeHtmlTags = "div|span|a|p|ul|ol|li|h[1-6]|br|hr|img|code|pre|em|strong|b|i|u|table|thead|tbody|tfoot|tr|td|th|details|summary|blockquote|section|nav|footer|header|main|aside|figure|figcaption|dl|dt|dd|sup|sub|del|ins|mark|small|abbr|cite|dfn|kbd|samp|var|wbr|!--";
    const safeTagRegex = new RegExp(`<(?!\\/?(?:${safeHtmlTags})[\\s>/])`, "g");

    content = parts
        .map((part, i) => {
            if (i % 2 === 1) return part; // code block - don't modify
            return part.replace(safeTagRegex, "\\<");
        })
        .join("");

    // 5. Add frontmatter if missing
    if (!content.startsWith("---")) {
        const basename = path.basename(filePath, path.extname(filePath));
        const title = basename
            .replace(/[-_]/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());

        content = `---\ntitle: "${title}"\n---\n\n` + content;
    }

    await fs.writeFile(filePath, content);
}

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

            if (entry.name === "meta.json") {
                await sanitizeMetaJson(destPath);
            } else if (entry.name.endsWith(".mdx") || entry.name.endsWith(".md")) {
                await sanitizeMdx(destPath);
            }
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
