import fs from "node:fs/promises";
import path from "node:path";

import type { ViteDevServer } from "vite";

import { resolvePaths } from "../../store/annotation-store";
import type { Annotation, AnnotationAttachment } from "../../types/annotations";
import { readAnnotations } from "../../store/annotation-store";

export interface ExportSessionFile {
    /** base64-encoded file content (data URL prefix included for binaries). */
    content: string;
    /** "text" for utf8 markdown/json, "base64" for binary attachments. */
    encoding: "base64" | "text";
    mimeType: string;
    /** Path inside the export bundle, e.g. "annotations.json" or
     *  "attachments/<id>/<file>.png". */
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
    const files: ExportSessionFile[] = [];

    files.push({
        content: JSON.stringify(annotations, null, 2),
        encoding: "text",
        mimeType: "application/json",
        path: "annotations.json",
    });

    files.push({
        content: markdown,
        encoding: "text",
        mimeType: "text/markdown",
        path: "annotations.md",
    });

    const collectAttachment = async (annotation: Annotation, attachment: AnnotationAttachment): Promise<void> => {
        if (!attachment.path.startsWith("attachments/")) {
            return;
        }

        const filepath = path.join(base, attachment.path);

        // Defensive: ensure the resolved path stays inside .devtoolbar/
        const resolvedBase = path.resolve(base);
        const resolvedFile = path.resolve(filepath);

        if (!(resolvedFile === resolvedBase || resolvedFile.startsWith(resolvedBase + path.sep))) {
            return;
        }

        try {
            const buffer = await fs.readFile(filepath);

            files.push({
                content: buffer.toString("base64"),
                encoding: "base64",
                mimeType: attachment.mimeType,
                path: attachment.path,
            });
        } catch {
            /* missing file — skip */
        }
    };

    for (const annotation of annotations) {
        if (annotation.screenshot) {
            try {
                const filepath = path.join(base, annotation.screenshot);
                const buffer = await fs.readFile(filepath);

                files.push({
                    content: buffer.toString("base64"),
                    encoding: "base64",
                    mimeType: `image/${path.extname(annotation.screenshot).slice(1) || "png"}`,
                    path: annotation.screenshot,
                });
            } catch {
                /* ignore */
            }
        }

        if (annotation.attachments) {
            for (const attachment of annotation.attachments) {
                await collectAttachment(annotation, attachment);
            }
        }
    }

    return {
        annotationCount: annotations.length,
        files,
        generatedAt: new Date().toISOString(),
    };
};
