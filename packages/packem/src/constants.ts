import { DEFAULTS as RESOLVE_DEFAULTS } from "@rollup/plugin-node-resolve";
import type { Loader } from "esbuild";

export const DEFAULT_EXTENSIONS = [...RESOLVE_DEFAULTS.extensions, ".ts", ".tsx", ".mjs", ".cjs", ".js", ".jsx"];

export const DEFAULT_LOADERS: Record<string, Loader> = {
    ".aac": "file",
    ".css": "file",
    ".eot": "file",
    ".flac": "file",
    ".gif": "file",
    ".jpeg": "file",
    ".jpg": "file",
    ".js": "js",
    ".json": "json",
    ".jsx": "jsx",
    ".mp3": "file",
    ".mp4": "file",
    ".ogg": "file",
    ".otf": "file",
    ".png": "file",
    ".svg": "file",
    ".ts": "ts",
    ".tsx": "tsx",
    ".ttf": "file",
    ".wav": "file",
    ".webm": "file",
    ".webp": "file",
    ".woff": "file",
    ".woff2": "file",
};
