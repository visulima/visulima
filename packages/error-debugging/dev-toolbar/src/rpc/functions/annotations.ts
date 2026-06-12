import fs from "node:fs/promises";
import path from "node:path";

import type { ViteDevServer } from "vite";

import {
    clampTextField,
    deleteScreenshotFile,
    ensureStoreDir,
    isPathInsideBase,
    MAX_ANNOTATIONS,
    MAX_THREAD_MESSAGES,
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

        const annotations = await readAnnotations(root);

        // Bound total growth from client-supplied data (DoS guard).
        if (annotations.length >= MAX_ANNOTATIONS) {
            throw new Error(`Annotation limit reached (${MAX_ANNOTATIONS}). Resolve or delete existing annotations before creating new ones.`);
        }

        // Explicitly pick only the fields we expect — never spread untrusted data.
        // Free-text fields are clamped to bound per-field size.
        const annotation: Annotation = {
            accessibility: data.accessibility,
            boundingBox: data.boundingBox,
            comment: clampTextField(data.comment),
            computedStyles: clampTextField(data.computedStyles),
            createdAt: now,
            cssClasses: clampTextField(data.cssClasses),
            elementBoundingBoxes: data.elementBoundingBoxes,
            elementLabel: clampTextField(data.elementLabel),
            elementPath: clampTextField(data.elementPath),
            elementTag: data.elementTag,
            frameworkContext: data.frameworkContext,
            fullPath: clampTextField(data.fullPath),
            id: crypto.randomUUID(),
            intent: data.intent,
            isFixed: data.isFixed,
            isMultiSelect: data.isMultiSelect,
            nearbyElements: clampTextField(data.nearbyElements),
            nearbyText: clampTextField(data.nearbyText),
            screenshot: data.screenshot,
            selectedText: clampTextField(data.selectedText),
            severity: data.severity,
            source: data.source,
            status: "pending",
            updatedAt: now,
            url: data.url,
            x: data.x,
            y: data.y,
        };

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
            annotation.comment = clampTextField(data.comment);
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

            // Bound thread growth from client-supplied data (DoS guard).
            if (annotation.thread.length >= MAX_THREAD_MESSAGES) {
                throw new Error(`Thread message limit reached (${MAX_THREAD_MESSAGES}) for this annotation.`);
            }

            // Override timestamp and generate ID server-side; clamp message text.
            annotation.thread.push({
                ...data.threadMessage,
                content: clampTextField(data.threadMessage.content),
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
