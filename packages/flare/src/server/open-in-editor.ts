import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import process from "node:process";

import launchEditorMiddleware from "launch-editor-middleware";

const respond400 = (
    response: ServerResponse<IncomingMessage> & { status?: (code: number) => ServerResponse<IncomingMessage> & { send: (body: string) => void } },
    next?: (err?: any) => void,
) => {
    try {
        if (typeof response.status === "function") {
            response.status(400).send("Failed to open editor");
            return;
        }
    } catch {}

    try {
        response.statusCode = 400;
        response.end("Failed to open editor");
    } catch {}

    if (typeof next === "function") {
        next();
    }
};

export type OpenInEditorOptions = {
    allowOutsideProject?: boolean;
    projectRoot?: string;
};

/**
 * Single universal handler factory for Node HTTP and Connect/Express.
 * - Accepts POST JSON or GET query (?file&line&column&editor)
 * - Enforces projectRoot unless allowOutsideProject is true
 * Usage:
 *   const openInEditor = createOpenInEditorMiddleware({ projectRoot: process.cwd() })
 *   // Node http
 *   if (url.pathname === '/__open-in-editor') return openInEditor(req, res)
 *   // Express/Connect
 *   app.post('/__open-in-editor', openInEditor)
 */
export const createOpenInEditorMiddleware = (options: OpenInEditorOptions = {}) => {
    return async function universalHandler(request: IncomingMessage & { body?: any }, response: ServerResponse, next?: (err?: any) => void) {
        try {
            const method = String(request.method || "GET").toUpperCase();

            let payload: any = {};

            if (method === "POST") {
                // Prefer existing parsed body (Express), otherwise parse
                if (request.body && typeof request.body === "object") {
                    payload = request.body;
                } else {
                    payload = await new Promise((resolve) => {
                        try {
                            let data = "";
                            request.on("data", (chunk: string) => (data += chunk));
                            request.on("end", () => {
                                try {
                                    resolve(data ? JSON.parse(data) : {});
                                } catch {
                                    resolve({});
                                }
                            });
                        } catch {
                            resolve({});
                        }
                    });
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

            const projectRoot = options.projectRoot ?? process.cwd();
            const absPath = path.isAbsolute(payload.file || "") ? String(payload.file || "") : path.resolve(projectRoot, String(payload.file || ""));

            if (!payload.file) {
                respond400(response, next);
                return;
            }

            if (!options.allowOutsideProject) {
                const rootWithSep = projectRoot.endsWith(path.sep) ? projectRoot : projectRoot + path.sep;

                if (!absPath.startsWith(rootWithSep)) {
                    respond400(response, next);

                    return;
                }
            }

            const mw = launchEditorMiddleware(payload.editor, projectRoot);
            const q = new URLSearchParams({ file: absPath, line: String(payload.line ?? 1), column: String(payload.column ?? 1) });

            if (payload.editor) {
                q.set("editor", String(payload.editor));
            }

            request.url = `/?${q.toString()}`;

            // If next provided, assume Connect/Express
            if (typeof next === "function") {
                mw(request, response, next);

                return;
            }

            // Node http usage: call and end
            await new Promise<void>((resolve) => mw(request, response, () => resolve()));
        } catch {
            respond400(response, next);
        }
    };
};

// Backwards-compat named factories (breaking changes allowed, but keep minimal aliases)
export const createNodeHttpHandler = (options: OpenInEditorOptions = {}) => {
    const handler = createOpenInEditorMiddleware(options);

    return async (req: IncomingMessage & { body?: any }, res: ServerResponse) => handler(req, res);
};

export const createExpressHandler = (options: OpenInEditorOptions = {}) => {
    return createOpenInEditorMiddleware(options);
};
