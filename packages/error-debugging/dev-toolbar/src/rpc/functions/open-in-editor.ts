import path from "node:path";

import type { ViteDevServer } from "vite";

import { isPathInsideBase } from "../../store/annotation-store";

/**
 * Open a file in the editor at a specific line/column.
 * Uses `launch-editor` which knows the right CLI flags for each editor
 * (e.g. `--goto` for VS Code, `-l` for vim, `--line` for Emacs, etc.).
 * @param server Vite dev server instance.
 * @param file File path (absolute or relative to server.config.root).
 * @param line Line number (1-based).
 * @param column Column number (1-based).
 * @param editor Optional editor override — any value accepted by launch-editor
 * (e.g. "code", "webstorm", "vim", "/usr/local/bin/hx"). When omitted,
 * launch-editor auto-detects from EDITOR / VISUAL env vars or the running IDE.
 */
const openInEditor = async (server: ViteDevServer, file: string, line?: number, column?: number, editor?: string): Promise<void> => {
    const filePath = path.resolve(server.config.root, file);

    if (!isPathInsideBase(filePath, server.config.root)) {
        throw new Error(`Refusing to open file outside project root: ${file}`);
    }

    const columnPart = column === undefined ? "" : `:${column}`;
    const position = line === undefined ? "" : `:${line}${columnPart}`;
    const target = `${filePath}${position}`;

    const { default: launch } = await import("launch-editor");

    launch(target, editor);
};

export { openInEditor };
export default openInEditor;
