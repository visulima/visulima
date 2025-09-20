// Shiki does not support `mjs` or `cjs` aliases by default.
// Map these to `.js` during error highlighting.
const ALTERNATIVE_JS_EXTS = ["cjs", "mjs"];
const ALTERNATIVE_MD_EXTS = ["mdoc"];

const findLanguageBasedOnExtension = (file: string): string => {
    const cleaned = file.split("?")[0] ?? file;
    const extension = cleaned.split(".").pop()?.toLowerCase();

    if (!extension) {
        return "javascript";
    }

    if (ALTERNATIVE_JS_EXTS.includes(extension)) {
        return "javascript";
    }

    if (ALTERNATIVE_MD_EXTS.includes(extension)) {
        return "markdown";
    }

    switch (extension) {
        case "js": {
            return "javascript";
        }
        case "json": {
            return "json";
        }
        case "json5": {
            return "json5";
        }
        case "jsonc": {
            return "jsonc";
        }
        case "jsx": {
            return "jsx";
        }
        case "sql": {
            return "sql";
        }
        case "ts": {
            return "typescript";
        }
        case "tsx": {
            return "tsx";
        }
        case "xml": {
            return "xml";
        }
        case "md": {
            return "markdown";
        }
        case "mdx": {
            return "mdx";
        }
        case "svelte": {
            return "svelte";
        }
        case "vue": {
            return "vue";
        }
        case "html": {
            return "html";
        }
        case "css": {
            return "css";
        }
        case "scss": {
            return "scss";
        }
        case "less": {
            return "less";
        }
        case "sass": {
            return "sass";
        }
        case "stylus": {
            return "stylus";
        }
        case "styl": {
            return "styl";
        }
        default: {
            return "javascript";
        }
    }
};

export default findLanguageBasedOnExtension;
