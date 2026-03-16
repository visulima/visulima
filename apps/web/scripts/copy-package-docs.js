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
 * Category display names and order for the packages sidebar.
 */
const CATEGORY_CONFIG = {
    "cli-terminal": { title: "CLI & Terminal", packages: ["cerebro", "pail", "command-line-args", "boxen", "tabular", "ansi", "colorize", "is-ansi-color-supported", "fmt"] },
    "data-manipulation": { title: "Data & Utilities", packages: ["string", "object", "deep-clone", "bytes", "humanizer", "redact", "content-safety"] },
    "filesystem": { title: "File System", packages: ["fs", "path", "find-cache-dir", "package", "tsconfig", "storage", "storage-client"] },
    "api": { title: "API & Web", packages: ["api-platform", "crud", "html", "pagination", "health-check", "jsdoc-open-api"] },
    "error-debugging": { title: "Error Handling", packages: ["error", "error-handler", "ono", "source-map", "inspector", "vite-overlay"] },
    "email": { title: "Internationalization & Communication", packages: ["iso-locale", "disposable-email-domains", "email"] },
    "dev-tools": { title: "Dev Tools", packages: ["dev-toolbar", "prisma-dmmf-transformer"] },
};

/**
 * Sanitizes meta.json pages array for fumadocs compatibility.
 * Converts object entries (e.g. { title: "Section", pages: [...] }) into
 * fumadocs-native separator + folder reference format.
 */
async function sanitizeMetaJson(filePath) {
    const content = await fs.readFile(filePath, "utf-8");
    const meta = JSON.parse(content);

    if (Array.isArray(meta.pages)) {
        const newPages = [];

        for (const entry of meta.pages) {
            if (typeof entry === "string") {
                newPages.push(entry);
            } else if (typeof entry === "object" && entry !== null && entry.title) {
                // Convert { title: "Section", pages: [...] } to separator + folder reference
                newPages.push(`---${entry.title}---`);

                if (Array.isArray(entry.pages)) {
                    // Extract the folder name from the first page path (e.g., "concepts/log-levels" -> "concepts")
                    const folders = new Set();

                    for (const page of entry.pages) {
                        const parts = page.split("/");

                        if (parts.length > 1) {
                            folders.add(parts[0]);
                        } else {
                            newPages.push(page);
                        }
                    }

                    for (const folder of folders) {
                        newPages.push(folder);
                    }
                }
            }
        }

        meta.pages = newPages;
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
    // Skip stripping if the file imports from fumadocs-ui (these components are valid there)
    const hasFumadocsImport = /^import\s+.*from\s+['"]fumadocs-ui\//m.test(content);

    if (!hasFumadocsImport) {
        const nextraComponents = "Callout|Tab|Tabs|Cards|Card|Steps|Step|FileTree|Bleed|Alert|CardGroup|Providers|QueryClientProvider";
        const wrapperRegex = new RegExp(`<(${nextraComponents})\\b[^>]*>([\\s\\S]*?)<\\/\\1>`, "g");
        const selfClosingRegex = new RegExp(`<(${nextraComponents})\\b[^>]*\\/>`, "g");

        for (let i = 0; i < 5; i++) {
            content = content.replace(wrapperRegex, "$2");
        }
        content = content.replace(selfClosingRegex, "");
    }

    // 4. Escape ALL angle brackets outside code blocks that aren't standard HTML tags.
    // This prevents MDX from interpreting TypeScript generics, comparison operators,
    // and other non-HTML angle brackets as JSX.
    const codeBlockRegex = /(```[\s\S]*?```|`[^`]+`)/g;
    const parts = content.split(codeBlockRegex);

    const fumadocsComponents = "Callout|Tab|Tabs|Cards|Card|Steps|Step|Files|Folder|File|DocsCategory|CodeBlockTabs|CodeBlockTabsList|CodeBlockTabsTrigger|CodeBlockTab|Accordions|Accordion|TypeTable|AutoTypeTable|ImageZoom";
    const safeHtmlTags = `div|span|a|p|ul|ol|li|h[1-6]|br|hr|img|code|pre|em|strong|b|i|u|table|thead|tbody|tfoot|tr|td|th|details|summary|blockquote|section|nav|footer|header|main|aside|figure|figcaption|dl|dt|dd|sup|sub|del|ins|mark|small|abbr|cite|dfn|kbd|samp|var|wbr|!--|${fumadocsComponents}`;
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
 * Recursively copies a directory, skipping Nextra-style _meta files.
 */
async function copyDirectory(src, dest) {
    await fs.mkdir(dest, { recursive: true });

    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        // Skip Nextra-style meta files (fumadocs uses meta.json)
        if (entry.name.startsWith("_meta")) {
            continue;
        }

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

    // Generate root packages/meta.json with categorized sidebar navigation
    const copiedPackages = await fs.readdir(DEST_DIR, { withFileTypes: true });
    const availablePackages = new Set(copiedPackages.filter((d) => d.isDirectory()).map((d) => d.name));

    const pages = [];

    for (const config of Object.values(CATEGORY_CONFIG)) {
        const categoryPackages = config.packages.filter((pkg) => availablePackages.has(pkg));

        if (categoryPackages.length === 0) {
            continue;
        }

        pages.push(`---${config.title}---`);
        pages.push(...categoryPackages);

        // Remove from available set to track uncategorized packages
        for (const pkg of categoryPackages) {
            availablePackages.delete(pkg);
        }
    }

    // Add any uncategorized packages at the end
    if (availablePackages.size > 0) {
        pages.push("---Other---");
        pages.push(...[...availablePackages].sort());
    }

    const rootMeta = {
        title: "Packages",
        pages: ["index", ...pages],
    };

    await fs.writeFile(path.join(DEST_DIR, "meta.json"), JSON.stringify(rootMeta, null, 4) + "\n");
    console.log("Generated packages/meta.json with categorized navigation");

    // Copy the static packages index page
    const indexSrc = path.join(__dirname, "..", "src", "content", "docs-static", "packages-index.mdx");

    try {
        await fs.stat(indexSrc);
        await fs.copyFile(indexSrc, path.join(DEST_DIR, "index.mdx"));
        console.log("Copied packages/index.mdx from static source");
    } catch {
        console.log("Warning: docs-static/packages-index.mdx not found, skipping index generation");
    }
}

/**
 * Copies root-level markdown files (e.g. CODE_OF_CONDUCT.md) into
 * apps/web/src/content/ so they can be compiled as MDX at build time.
 */
async function copyRootMarkdown() {
    const contentDir = path.join(__dirname, "..", "src", "content");
    await fs.mkdir(contentDir, { recursive: true });

    const files = [
        { src: path.join(ROOT_DIR, ".github", "CODE_OF_CONDUCT.md"), dest: path.join(contentDir, "code-of-conduct.md") },
    ];

    for (const { src, dest } of files) {
        try {
            await fs.copyFile(src, dest);
            console.log(`Copied ${path.relative(ROOT_DIR, src)} → ${path.relative(path.join(__dirname, ".."), dest)}`);
        } catch {
            console.warn(`Warning: ${path.relative(ROOT_DIR, src)} not found, skipping`);
        }
    }
}

Promise.all([main(), copyRootMarkdown()]).catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
