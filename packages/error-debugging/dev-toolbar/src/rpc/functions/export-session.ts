import fs from "node:fs/promises";
import path from "node:path";

import type { ViteDevServer } from "vite";

import { readAnnotations, resolvePaths } from "../../store/annotation-store";
import type { AnnotationAttachment } from "../../types/annotations";

export interface ExportSessionFile {
    /** base64-encoded file content (data URL prefix included for binaries). */
    content: string;
    /** "text" for utf8 markdown/json, "base64" for binary attachments. */
    encoding: "base64" | "text";
    mimeType: string;

    /**
     * Path inside the export bundle.
     * @example "annotations.json"
     * @example "attachments/&lt;id>/&lt;file>.png"
     */
    path: string;
}

export interface ExportSessionResult {
    annotationCount: number;
    files: ExportSessionFile[];
    /** ISO timestamp of when the bundle was assembled. */
    generatedAt: string;
}

/**
 * Bundle every annotation, every attachment, and a markdown export of the
 * session into a flat list of files. The frontend turns this into either a
 * single-file download (concatenated markdown) or a multi-file zip via
 * `client/zip-utils` (kept on the client to avoid a server-side zip
 * dependency).
 */
export const exportSession = async (server: ViteDevServer, markdown: string): Promise<ExportSessionResult> => {
    const { root } = server.config;
    const annotations = await readAnnotations(root);
    const { base } = resolvePaths(root);
    const resolvedBase = path.resolve(base);

    const isInsideStore = (filepath: string): boolean => {
        const resolved = path.resolve(filepath);

        return resolved === resolvedBase || resolved.startsWith(resolvedBase + path.sep);
    };

    const readBinary = async (relPath: string, mimeType: string): Promise<ExportSessionFile | null> => {
        const filepath = path.join(base, relPath);

        if (!isInsideStore(filepath)) {
            return null;
        }

        try {
            const buffer = await fs.readFile(filepath);

            return { content: buffer.toString("base64"), encoding: "base64", mimeType, path: relPath };
        } catch {
            return null;
        }
    };

    const screenshotJobs = annotations
        .filter((a): a is typeof a & { screenshot: string } => Boolean(a.screenshot))
        .map(async (a) => readBinary(a.screenshot, `image/${path.extname(a.screenshot).slice(1) || "png"}`));

    const attachmentJobs = annotations
        .flatMap((a) => a.attachments ?? [])
        .filter((attachment: AnnotationAttachment) => attachment.path.startsWith("attachments/"))
        .map(async (attachment) => readBinary(attachment.path, attachment.mimeType));

    const binaryFiles = (await Promise.all([...screenshotJobs, ...attachmentJobs])).filter((f): f is ExportSessionFile => f !== null);

    const files: ExportSessionFile[] = [
        {
            content: JSON.stringify(annotations, null, 2),
            encoding: "text",
            mimeType: "application/json",
            path: "annotations.json",
        },
        {
            content: markdown,
            encoding: "text",
            mimeType: "text/markdown",
            path: "annotations.md",
        },
        ...binaryFiles,
    ];

    return {
        annotationCount: annotations.length,
        files,
        generatedAt: new Date().toISOString(),
    };
};
