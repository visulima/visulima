import { realpathSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";

// eslint-disable-next-line import/no-extraneous-dependencies
import { isAbsolute, normalize, relative, resolve as resolvePath, sep } from "@visulima/path";
// eslint-disable-next-line import/no-extraneous-dependencies
import launchEditorMiddleware from "launch-editor-middleware";

import { getProcessPlatform } from "../utils/process";

type EditorPayload = {
    column?: number;
    editor?: string;
    file?: string;
    line?: number;
};

type RequestBody = Record<string, unknown>;

type UniversalHandler = (request: IncomingMessage & { body?: RequestBody }, response: ServerResponse, next?: (error?: unknown) => void) => Promise<void>;

const respond400 = (
    response: ServerResponse<IncomingMessage> & { status?: (code: number) => ServerResponse<IncomingMessage> & { send: (body: string) => void } },
) => {
    if (typeof response.status === "function") {
        response.status(400).send("Failed to open editor");

        return;
    }

    response.statusCode = 400;
    response.end("Failed to open editor");
};

// Backwards-compat named factories (breaking changes allowed, but keep minimal aliases)
type NodeHttpHandler = (request: IncomingMessage & { body?: RequestBody }, response: ServerResponse) => Promise<void>;

export type OpenInEditorOptions = {
    allowOutsideProject?: boolean;
    projectRoot?: string;
};

/**
 * Single universal handler factory for Node HTTP and Connect/Express.
 * Accepts POST JSON or GET query (?file&amp;line&amp;column&amp;editor).
 * Enforces projectRoot unless allowOutsideProject is true.
 * @example
 * ```typescript
 * const openInEditor = createOpenInEditorMiddleware({ projectRoot: process.cwd() })
 * // Node http
 * if (url.pathname === '/__open-in-editor') return openInEditor(req, res)
 * // Express/Connect
 * app.post('/__open-in-editor', openInEditor)
 * ```
 */
export const createOpenInEditorMiddleware = (options: OpenInEditorOptions = {}): UniversalHandler => {
    const parseRequestBody = async (request: IncomingMessage & { body?: RequestBody }): Promise<EditorPayload> => {
        const method = String(request.method || "GET").toUpperCase();

        if (method === "POST") {
            if (request.body && typeof request.body === "object") {
                return request.body as EditorPayload;
            }

            return new Promise((resolve) => {
                try {
                    let data = "";

                    const onData = (chunk: unknown) => {
                        data += String(chunk);
                    };

                    const onEnd = () => {
                        try {
                            resolve((data ? JSON.parse(data) : {}) as EditorPayload);
                        } catch {
                            resolve({} as EditorPayload);
                        }
                    };

                    request.on("data", onData);
                    request.on("end", onEnd);
                    request.on("error", () => resolve({} as EditorPayload));
                } catch {
                    resolve({} as EditorPayload);
                }
            });
        }

        const url = new URL(request.url || "", "http://localhost");

        return {
            column: Number(url.searchParams.get("column") || 1),
            editor: url.searchParams.get("editor") || undefined,
            file: url.searchParams.get("file") || undefined,
            line: Number(url.searchParams.get("line") || 1),
        };
    };

    // eslint-disable-next-line sonarjs/cognitive-complexity
    const validateFilePath = (filePath: string | undefined, projectRoot: string, allowOutsideProject: boolean): string | undefined => {
        if (!filePath) {
            return undefined;
        }

        const absPath = isAbsolute(filePath) ? filePath : resolvePath(projectRoot, filePath);

        if (!allowOutsideProject) {
            try {
                // Resolve symlinks for both project root and target path
                const projectRootResolved = realpathSync(projectRoot);
                const targetResolved = realpathSync(absPath);

                // Normalize both paths
                const normalizedProjectRoot = normalize(projectRootResolved);
                const normalizedTarget = normalize(targetResolved);

                // On case-insensitive platforms, compare lowercased versions
                const isCaseInsensitive = getProcessPlatform() === "win32" || getProcessPlatform() === "darwin";
                const projectRootCompare = isCaseInsensitive ? normalizedProjectRoot.toLowerCase() : normalizedProjectRoot;
                const targetCompare = isCaseInsensitive ? normalizedTarget.toLowerCase() : normalizedTarget;

                const relativePath = relative(normalizedProjectRoot, normalizedTarget);

                // Check if target is outside project root:
                // - If relative path starts with '..' it's outside
                // - If relative path is absolute, it's outside
                // - If paths don't match on case-insensitive platforms, it's outside
                if (relativePath.startsWith("..") || isAbsolute(relativePath) || (isCaseInsensitive && !targetCompare.startsWith(projectRootCompare))) {
                    return undefined;
                }
            } catch {
                // If realpathSync fails (e.g., file doesn't exist), fall back to basic check
                const rootWithSeparator = projectRoot.endsWith(sep) ? projectRoot : projectRoot + sep;

                if (!absPath.startsWith(rootWithSeparator)) {
                    return undefined;
                }
            }
        }

        return absPath;
    };

    return async function universalHandler(request: IncomingMessage & { body?: RequestBody }, response: ServerResponse, next?: (error?: unknown) => void) {
        try {
            const payload = await parseRequestBody(request);
            const projectRoot = options.projectRoot ?? process.cwd();
            const absPath = validateFilePath(payload.file, projectRoot, options.allowOutsideProject ?? false);

            if (!absPath) {
                respond400(response);

                return;
            }

            const mw = launchEditorMiddleware(payload.editor, projectRoot);

            const q = new URLSearchParams({
                column: String(payload.column ?? 1),
                file: absPath,
                line: String(payload.line ?? 1),
            });

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
            await new Promise<void>((resolve) => {
                mw(request, response, () => {
                    resolve();
                });
            });
        } catch {
            respond400(response);
        }
    };
};

export const createNodeHttpHandler = (options: OpenInEditorOptions = {}): NodeHttpHandler => {
    const handler = createOpenInEditorMiddleware(options);

    return async (request: IncomingMessage & { body?: RequestBody }, response: ServerResponse) => handler(request, response);
};

export const createExpressHandler = (options: OpenInEditorOptions = {}): UniversalHandler => createOpenInEditorMiddleware(options);
