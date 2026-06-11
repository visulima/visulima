// Shiki does not support `mjs`/`cjs`/`cts`/`mts` aliases by default, so map the
// JS/TS module variants onto their base grammar during error highlighting.
const ALTERNATIVE_JS_EXTS = new Set(["cjs", "mjs"]);
const ALTERNATIVE_TS_EXTS = new Set(["cts", "mts"]);
const ALTERNATIVE_MD_EXTS = new Set(["mdoc"]);

/**
 * Resolves a Shiki language id from a file path / stack-frame path.
 *
 * Unknown extensions fall back to `"text"` (an honest, no-highlight grammar)
 * rather than `"javascript"`, so a `.py` or `.rs` frame is never mis-coloured
 * as JavaScript.
 *
 * @param file A file path or stack-frame path (query strings are stripped).
 * @returns The Shiki language id, or `"text"` when the extension is unknown.
 */
const findLanguageBasedOnExtension = (file: string): string => {
    const cleaned = file.split("?")[0] ?? file;
    const extension = cleaned.split(".").pop()?.toLowerCase();

    if (!extension) {
        return "text";
    }

    if (ALTERNATIVE_JS_EXTS.has(extension)) {
        return "javascript";
    }

    if (ALTERNATIVE_TS_EXTS.has(extension)) {
        return "typescript";
    }

    if (ALTERNATIVE_MD_EXTS.has(extension)) {
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
        case "yaml":
        case "yml": {
            return "yaml";
        }
        case "toml": {
            return "toml";
        }
        case "py": {
            return "python";
        }
        case "go": {
            return "go";
        }
        case "rs": {
            return "rust";
        }
        case "rb": {
            return "ruby";
        }
        case "php": {
            return "php";
        }
        case "graphql":
        case "gql": {
            return "graphql";
        }
        case "dockerfile": {
            return "dockerfile";
        }
        case "sh":
        case "bash": {
            return "bash";
        }
        case "txt": {
            return "text";
        }
        default: {
            return "text";
        }
    }
};

export default findLanguageBasedOnExtension;
