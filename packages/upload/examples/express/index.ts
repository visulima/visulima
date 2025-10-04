import { File as DiskFile, DiskStorage, ImageTransformer, Multipart } from "@visulima/upload";
import { copyFile } from "copy-file";
import express from "express";
import fs from "node:fs";
import path from "node:path";

const PORT = process.env.PORT || 3002;

const app = express();

type Moving = { percent: number; status: "moving" | "error" | "done" };

const processes = {} as Record<string, Moving>;

const uploadDirectory = "upload";
const moveTo = "files";

const storage = new DiskStorage({ directory: uploadDirectory });

const imageTransformer = new ImageTransformer(storage, {
    maxImageSize: 10 * 1024 * 1024, // 10MB
    enableCache: true,
    cacheTtl: 3600, // 1 hour
});

const onComplete: express.RequestHandler = (req, res) => {
    const file = req.body as DiskFile;
    const moving = (processes[file.name] ??= {} as Moving);
    if (!moving.status) {
        moving.status = "moving";
        const source = path.resolve(uploadDirectory, file.name);
        const destination = path.resolve(moveTo, file.originalName);
        void (async () => {
            try {
                await copyFile(source, destination, {
                    onProgress: ({ percent }) => {
                        moving.percent = percent * 100;
                    },
                });
                await fs.promises.unlink(source);
                moving.status = "done";
            } catch (e) {
                console.error(e);
                moving.status = "error";
            }
        })();
    }
    if (moving.status === "error") {
        res.status(422).json({ ...file, moving });
    } else if (moving.status === "done") {
        res.json({ ...file, moving });
    } else {
        res.status(202)
            // .set('Retry-After', '5') // override polling interval
            .json({ ...file, moving });
    }
};

const multipart = new Multipart({ storage });

app.use("/files", multipart.upload, onComplete);

// Image transformation with query parameters
// Example: GET /files/abc123?width=300&height=200&fit=cover&quality=80
// Supports: width, height, fit, position, quality, lossless, effort, alphaQuality, loop, delay
app.get("/files/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { width, height, fit, position, quality, lossless, effort, alphaQuality, loop, delay } = req.query;

        // Check if any transformation parameters are provided
        const hasTransformParams = width || height || fit || position || quality || lossless || effort || alphaQuality || loop || delay;

        if (!hasTransformParams) {
            // No transformation requested, serve original file
            try {
                const file = await storage.get({ id });

                res.set({
                    "Content-Type": file.contentType,
                    "Content-Length": file.size,
                    ETag: file.ETag,
                    ...(file.expiredAt && { "X-Upload-Expires": file.expiredAt.toString() }),
                    ...(file.modifiedAt && { "Last-Modified": file.modifiedAt.toString() }),
                    "Cache-Control": "public, max-age=31536000", // Cache for 1 year
                });

                res.send(file.content);
                return;
            } catch (error: any) {
                console.error("File serving error:", error);
                res.status(404).json({ error: "File not found" });
                return;
            }
        }

        // Apply transformations based on query parameters
        const steps: any[] = [];

        if (width || height) {
            const resizeOptions: any = {};

            if (width) resizeOptions.width = Number(width);
            if (height) resizeOptions.height = Number(height);
            if (fit) resizeOptions.fit = fit as string;
            if (position) resizeOptions.position = position as string;

            steps.push({
                type: "resize",
                options: resizeOptions,
            });
        }

        // Quality and format options
        const formatOptions: any = {};
        if (quality) formatOptions.quality = Number(quality);
        if (lossless) formatOptions.lossless = lossless === "true";
        if (effort) formatOptions.effort = Number(effort);
        if (alphaQuality) formatOptions.alphaQuality = Number(alphaQuality);
        if (loop) formatOptions.loop = Number(loop);
        if (delay) formatOptions.delay = Number(delay);

        if (Object.keys(formatOptions).length > 0) {
            steps.push({
                type: "format",
                options: formatOptions,
            });
        }

        const result = await imageTransformer.transform(id, steps);

        res.set({
            "Content-Type": `image/${result.format}`,
            "Content-Length": result.size,
            "X-Image-Width": result.width,
            "X-Image-Height": result.height,
            "Cache-Control": "public, max-age=31536000", // Cache for 1 year
        });

        res.send(result.buffer);
    } catch (error: any) {
        console.error("Image transformation error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Legacy image transformation routes (deprecated)
app.get("/images/:id/resize", async (req, res) => {
    try {
        const { id } = req.params;
        const { width, height, fit = "cover", quality = 80 } = req.query;

        const result = await imageTransformer.resize(id, {
            width: width ? Number(width) : undefined,
            height: height ? Number(height) : undefined,
            fit: fit as "cover" | "contain" | "fill" | "inside" | "outside",
            quality: Number(quality),
            format: "jpeg",
        });

        res.set({
            "Content-Type": `image/${result.format}`,
            "Content-Length": result.size,
            "X-Image-Width": result.width,
            "X-Image-Height": result.height,
        });

        res.send(result.buffer);
    } catch (error: any) {
        console.error("Resize error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get("/images/:id/crop", async (req, res) => {
    try {
        const { id } = req.params;
        const { left, top, width, height, quality = 80 } = req.query;

        if (!left || !top || !width || !height) {
            return res.status(400).json({ error: "Missing crop parameters: left, top, width, height" });
        }

        const result = await imageTransformer.crop(id, {
            left: Number(left),
            top: Number(top),
            width: Number(width),
            height: Number(height),
            quality: Number(quality),
            format: "jpeg",
        });

        res.set({
            "Content-Type": `image/${result.format}`,
            "Content-Length": result.size,
            "X-Image-Width": result.width,
            "X-Image-Height": result.height,
        });

        res.send(result.buffer);
    } catch (error: any) {
        console.error("Crop error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get("/images/:id/rotate", async (req, res) => {
    try {
        const { id } = req.params;
        const { angle = 90, quality = 80 } = req.query;

        const result = await imageTransformer.rotate(id, {
            angle: Number(angle) as 90 | 180 | 270,
            quality: Number(quality),
            format: "jpeg",
        });

        res.set({
            "Content-Type": `image/${result.format}`,
            "Content-Length": result.size,
            "X-Image-Width": result.width,
            "X-Image-Height": result.height,
        });

        res.send(result.buffer);
    } catch (error: any) {
        console.error("Rotate error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get("/images/:id/convert", async (req, res) => {
    try {
        const { id } = req.params;
        const { format = "webp", quality = 80 } = req.query;

        const result = await imageTransformer.convertFormat(id, format as string, {
            quality: Number(quality),
        });

        res.set({
            "Content-Type": `image/${result.format}`,
            "Content-Length": result.size,
            "X-Image-Width": result.width,
            "X-Image-Height": result.height,
        });

        res.send(result.buffer);
    } catch (error: any) {
        console.error("Convert error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Pipeline transformation example
app.get("/images/:id/transform", async (req, res) => {
    try {
        const { id } = req.params;
        const { width = 400, height = 300, rotate = 0, format = "webp" } = req.query;

        const steps = [
            {
                type: "resize" as const,
                options: {
                    width: Number(width),
                    height: Number(height),
                    fit: "cover" as const,
                    quality: 85,
                },
            },
        ];

        if (Number(rotate) > 0) {
            steps.push({
                type: "rotate" as const,
                options: {
                    angle: Number(rotate) as 90 | 180 | 270,
                },
            });
        }

        steps.push({
            type: "format" as const,
            options: {
                format: format as "webp",
                quality: 85,
            },
        });

        const result = await imageTransformer.transform(id, steps);

        res.set({
            "Content-Type": `image/${result.format}`,
            "Content-Length": result.size,
            "X-Image-Width": result.width,
            "X-Image-Height": result.height,
        });

        res.send(result.buffer);
    } catch (error: any) {
        console.error("Transform error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => console.log("listening on port:", PORT));
