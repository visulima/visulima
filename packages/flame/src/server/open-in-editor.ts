import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import process from "node:process";

import openEditor from "open-editor";

export type OpenInEditorRequest = {
    column?: number;
    editor?: string;
    file: string;
    line?: number;
};

export type OpenInEditorOptions = {
    allowOutsideProject?: boolean;
    projectRoot?: string;
};

/**
 * Core utility to open the user's editor safely.
 */
export const openInEditor = async (request: OpenInEditorRequest, options: OpenInEditorOptions = {}): Promise<void> => {
    const { column = 1, editor, file, line = 1 } = request;

    if (!file || typeof file !== "string") {
        throw new Error("'file' is required");
    }

    const projectRoot = options.projectRoot ?? process.cwd();
    const absPath = path.resolve(projectRoot, file);

    if (!options.allowOutsideProject && !absPath.startsWith(projectRoot + path.sep)) {
        throw new Error("Forbidden path");
    }

    await openEditor([{ column, file: absPath, line }], editor ? { editor } : undefined);
};

/**
 * Minimal Node http handler factory (works with any Node HTTP-based server).
 * Accepts POST JSON or GET query params.
 */
export const createNodeHttpHandler = (options: OpenInEditorOptions = {}) =>
    async function handler(request: IncomingMessage, response: ServerResponse) {
        try {
            const method = (request.method || "GET").toUpperCase();
            let payload: any = {};

            if (method === "POST") {
                const body = await new Promise<string>((resolve) => {
                    let data = "";

                    request.on("data", (chunk) => (data += chunk));
                    request.on("end", () => resolve(data));
                });

                try {
                    payload = body ? JSON.parse(body) : {};
                } catch {
                    payload = {};
                }
            } else {
                const url = new URL(request.url || "", "http://localhost");

                payload = {
                    column: Number(url.searchParams.get("column") || 1),
                    editor: url.searchParams.get("editor") || undefined,
                    file: url.searchParams.get("file") || undefined,
                    line: Number(url.searchParams.get("line") || 1),
                };
            }

            await openInEditor(payload, options);

            response.statusCode = 204;
            response.end();
        } catch {
            response.statusCode = 400;
            response.end("Failed to open editor");
        }
    };

/**
 * Express/Connect-style handler factory.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const createExpressHandler = (options: OpenInEditorOptions = {}) =>
    async function handler(request: any, response: any) {
        try {
            const payload = { ...request.query, ...request.body } as OpenInEditorRequest;

            if (typeof payload.line === "string") {
                payload.line = Number(payload.line);
            }

            if (typeof payload.column === "string") {
                payload.column = Number(payload.column);
            }

            await openInEditor(payload, options);

            response.status(204).end();
        } catch {
            response.status(400).send("Failed to open editor");
        }
    };
