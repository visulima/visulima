import path from "node:path";

import type { ViteDevServer } from "vite";

/**
 * Open a file in the editor at a specific line/column.
 * Uses `launch-editor` which knows the right CLI flags for each editor
 * (e.g. `--goto` for VS Code, `-l` for vim, `--line` for Emacs, etc.).
 * @param server Vite dev server instance
 * @param file File path (absolute or relative to server.config.root)
 * @param line Line number (1-based)
 * @param column Column number (1-based)
 * @param editor Optional editor override — any value accepted by launch-editor
 * (e.g. "code", "webstorm", "vim", "/usr/local/bin/hx"). When omitted,
 * launch-editor auto-detects from EDITOR / VISUAL env vars or the running IDE.
 */
export const openInEditor = async (server: ViteDevServer, file: string, line?: number, column?: number, editor?: string): Promise<void> => {
    const filePath = file.startsWith("/") ? file : path.join(server.config.root, file);
    const position = line === undefined ? "" : `:${line}${column === undefined ? "" : `:${column}`}`;
    const target = `${filePath}${position}`;

    const { default: launch } = await import("launch-editor");

    launch(target, editor);
};
