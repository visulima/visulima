import path from "node:path";

import type { ViteDevServer } from "vite";

/**
 * Strip Vite's query suffixes (e.g. `?vue&type=script`, `?import`,
 * `?__visulima-dev-toolbar-resource`) and any URL fragment so the path
 * resolves cleanly on disk. Defensive against module IDs leaking through
 * `data-vdt-source` and against client-side routers (hash routing) that
 * might attach a fragment to an editor URL.
 */
const stripUrlNoise = (file: string): string => {
    const queryIndex = file.indexOf("?");
    const withoutQuery = queryIndex === -1 ? file : file.slice(0, queryIndex);
    const hashIndex = withoutQuery.indexOf("#");

    return hashIndex === -1 ? withoutQuery : withoutQuery.slice(0, hashIndex);
};

/**
 * Open a file in the editor at a specific line/column.
 * Uses `launch-editor` which knows the right CLI flags for each editor
 * (e.g. `--goto` for VS Code, `-l` for vim, `--line` for Emacs, etc.).
 * @param server Vite dev server instance.
 * @param file File path (absolute or relative to server.config.root). Any
 * Vite query suffix or URL fragment is stripped before resolution.
 * @param line Line number (1-based).
 * @param column Column number (1-based).
 * @param editor Optional editor override — any value accepted by launch-editor
 * (e.g. "code", "webstorm", "vim", "/usr/local/bin/hx"). When omitted,
 * launch-editor auto-detects from EDITOR / VISUAL env vars or the running IDE.
 */
const openInEditor = async (server: ViteDevServer, file: string, line?: number, column?: number, editor?: string): Promise<void> => {
    const cleanFile = stripUrlNoise(file);
    const filePath = cleanFile.startsWith("/") ? cleanFile : path.join(server.config.root, cleanFile);
    const columnPart = column === undefined ? "" : `:${column}`;
    const position = line === undefined ? "" : `:${line}${columnPart}`;
    const target = `${filePath}${position}`;

    const { default: launch } = await import("launch-editor");

    launch(target, editor);
};

export { openInEditor };
export default openInEditor;
