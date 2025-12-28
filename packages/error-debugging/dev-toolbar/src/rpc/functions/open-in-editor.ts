import type { ViteDevServer } from 'vite';

/**
 * Open file in editor
 * @param server - Vite dev server instance
 * @param file - File path
 * @param line - Line number (1-based)
 * @param column - Column number (1-based)
 */
export const openInEditor = async (server: ViteDevServer, file: string, line?: number, column?: number): Promise<void> => {
  // Use Vite's built-in openInEditor if available
  if (server.openInEditor) {
    await server.openInEditor(file, { line, column });
    return;
  }

  // Fallback: try to use environment variable EDITOR
  const editor = process.env.EDITOR || process.env.VISUAL || 'code';
  const filePath = file.startsWith('/') ? file : `${server.config.root}/${file}`;
  const position = line && column ? `:${line}:${column}` : line ? `:${line}` : '';

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { spawn } = require('node:child_process');

  spawn(editor, [`${filePath}${position}`], {
    detached: true,
    stdio: 'ignore',
  });
};
