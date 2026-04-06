import fs from "node:fs/promises";
import path from "node:path";

import type { ViteDevServer } from "vite";

import {
    deleteScreenshotFile,
    ensureStoreDir,
    isPathInsideBase,
    readAnnotations,
    resolvePaths,
    sanitizeId,
    SCREENSHOTS_DIR,
    withLock,
    writeAnnotations,
} from "../../store/annotation-store";
import type { Annotation, CreateAnnotationData, UpdateAnnotationData } from "../../types/annotations";

/**
 * Get all annotations.
 */
export const getAnnotations = async (server: ViteDevServer): Promise<Annotation[]> => readAnnotations(server.config.root);

/**
 * Create a new annotation.
 * Only picks known fields from data to prevent injection of server-managed fields.
 */
export const createAnnotation = async (server: ViteDevServer, data: CreateAnnotationData): Promise<Annotation> =>
    withLock(async () => {
        const { root } = server.config;
        const now = new Date().toISOString();

        // Explicitly pick only the fields we expect — never spread untrusted data
        const annotation: Annotation = {
            accessibility: data.accessibility,
            boundingBox: data.boundingBox,
            comment: data.comment,
            computedStyles: data.computedStyles,
            createdAt: now,
            cssClasses: data.cssClasses,
            elementBoundingBoxes: data.elementBoundingBoxes,
            elementLabel: data.elementLabel,
            elementPath: data.elementPath,
            elementTag: data.elementTag,
            frameworkContext: data.frameworkContext,
            fullPath: data.fullPath,
            id: crypto.randomUUID(),
            intent: data.intent,
            isFixed: data.isFixed,
            isMultiSelect: data.isMultiSelect,
            nearbyElements: data.nearbyElements,
            nearbyText: data.nearbyText,
            screenshot: data.screenshot,
            selectedText: data.selectedText,
            severity: data.severity,
            source: data.source,
            status: "pending",
            updatedAt: now,
            url: data.url,
            x: data.x,
            y: data.y,
        };

        const annotations = await readAnnotations(root);

        annotations.push(annotation);
        await writeAnnotations(root, annotations);

        return annotation;
    });

/**
 * Update an existing annotation.
 */
export const updateAnnotation = async (server: ViteDevServer, id: string, data: UpdateAnnotationData): Promise<Annotation | null> =>
    withLock(async () => {
        const { root } = server.config;
        const annotations = await readAnnotations(root);
        const index = annotations.findIndex((a) => a.id === id);

        if (index === -1) {
            return null;
        }

        const annotation = annotations[index]!;
        const now = new Date().toISOString();

        if (data.comment !== undefined) {
            annotation.comment = data.comment;
        }

        if (data.intent !== undefined) {
            annotation.intent = data.intent;
        }

        if (data.severity !== undefined) {
            annotation.severity = data.severity;
        }

        if (data.status !== undefined) {
            annotation.status = data.status;

            if (data.status === "resolved" || data.status === "dismissed") {
                annotation.resolvedBy = data.resolvedBy ?? "human";
                annotation.resolvedAt = now;

                // Clean up screenshot on resolution
                if (annotation.screenshot) {
                    await deleteScreenshotFile(root, annotation.screenshot);
                    annotation.screenshot = undefined;
                }
            }
        }

        if (data.threadMessage) {
            if (!annotation.thread) {
                annotation.thread = [];
            }

            // Override timestamp and generate ID server-side
            annotation.thread.push({
                ...data.threadMessage,
                id: crypto.randomUUID(),
                timestamp: now,
            });
        }

        annotation.updatedAt = now;
        annotations[index] = annotation;
        await writeAnnotations(root, annotations);

        return annotation;
    });

/**
 * Delete an annotation.
 */
export const deleteAnnotation = async (server: ViteDevServer, id: string): Promise<boolean> =>
    withLock(async () => {
        const { root } = server.config;
        const annotations = await readAnnotations(root);
        const index = annotations.findIndex((a) => a.id === id);

        if (index === -1) {
            return false;
        }

        const annotation = annotations[index]!;

        // Clean up screenshot
        if (annotation.screenshot) {
            await deleteScreenshotFile(root, annotation.screenshot);
        }

        annotations.splice(index, 1);
        await writeAnnotations(root, annotations);

        return true;
    });

/**
 * Save a screenshot from a base64 data URL.
 * Returns the relative path within .devtoolbar/ (e.g. "screenshots/&lt;id>.png").
 */
export const saveScreenshot = async (server: ViteDevServer, annotationId: string, dataUrl: string): Promise<string> => {
    const { root } = server.config;

    await ensureStoreDir(root);

    const { base, screenshotsDir } = resolvePaths(root);

    // Sanitize the annotation ID to prevent path traversal
    const safeId = sanitizeId(annotationId);

    if (!safeId) {
        throw new Error("Invalid annotation ID");
    }

    let extension: string;
    let buffer: Buffer;

    if (dataUrl.startsWith("data:image/png;base64,")) {
        extension = "png";
        buffer = Buffer.from(dataUrl.slice("data:image/png;base64,".length), "base64");
    } else if (dataUrl.startsWith("data:image/jpeg;base64,")) {
        extension = "jpg";
        buffer = Buffer.from(dataUrl.slice("data:image/jpeg;base64,".length), "base64");
    } else if (dataUrl.startsWith("data:image/webp;base64,")) {
        extension = "webp";
        buffer = Buffer.from(dataUrl.slice("data:image/webp;base64,".length), "base64");
    } else {
        throw new Error("Unsupported screenshot format. Expected PNG, JPEG, or WebP data URL.");
    }

    const filename = `${safeId}.${extension}`;
    const filepath = path.join(screenshotsDir, filename);

    // Validate the resolved path stays inside the store
    if (!isPathInsideBase(filepath, base)) {
        throw new Error("Invalid screenshot path");
    }

    await fs.writeFile(filepath, buffer);

    return `${SCREENSHOTS_DIR}/${filename}`;
};

/**
 * Get a screenshot as a base64 data URL.
 */
export const getScreenshot = async (server: ViteDevServer, annotationId: string): Promise<string | null> => {
    const { root } = server.config;
    const annotations = await readAnnotations(root);
    const annotation = annotations.find((a) => a.id === annotationId);

    if (!annotation?.screenshot) {
        return null;
    }

    // Validate the screenshot path before reading
    if (!annotation.screenshot.startsWith(`${SCREENSHOTS_DIR}/`)) {
        return null;
    }

    const { base } = resolvePaths(root);
    const filepath = path.join(base, annotation.screenshot);

    // Prevent directory traversal
    if (!isPathInsideBase(filepath, base)) {
        return null;
    }

    try {
        const buffer = await fs.readFile(filepath);
        const extension = path.extname(filepath).slice(1);

        if (extension === "svg") {
            return `data:image/svg+xml,${encodeURIComponent(buffer.toString("utf8"))}`;
        }

        const mimeType = extension === "jpg" ? "image/jpeg" : `image/${extension}`;

        return `data:${mimeType};base64,${buffer.toString("base64")}`;
    } catch {
        return null;
    }
};
