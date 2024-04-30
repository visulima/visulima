import { DEFAULTS as RESOLVE_DEFAULTS } from "@rollup/plugin-node-resolve";
import type { Loader } from "esbuild";

export const NODE_RESOLVE_EXTENSIONS = [...RESOLVE_DEFAULTS.extensions, ".cjs"];
export const DEFAULT_EXTENSIONS = [...NODE_RESOLVE_EXTENSIONS, ".ts", ".cts", ".mts", ".tsx", ".jsx"];

export const DEFAULT_LOADERS: Record<string, Loader> = {
    ".aac": "file",
    ".cjs": "js",
    ".css": "file",
    ".cts": "ts",
    ".eot": "file",
    ".flac": "file",
    ".gif": "file",
    ".jpeg": "file",
    ".jpg": "file",
    ".js": "js",
    // Add .json files support - require @rollup/plugin-json
    ".json": "json",
    ".jsx": "jsx",
    ".mjs": "js",
    ".mp3": "file",
    ".mp4": "file",
    ".mts": "ts",
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

export const RUNTIME_EXPORT_CONVENTIONS = [
  'react-server',
  'react-native',
  'edge-light',
];

export const EXCLUDE_REGEXP = /node_modules/;
