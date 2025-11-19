import type { UploadFile } from "@visulima/storage";
import { DiskStorage } from "@visulima/storage";
import { Multipart } from "@visulima/storage/handler/http/node";
import { xhrOpenApiSpec, transformOpenApiSpec } from "@visulima/storage/openapi";
import ImageTransformer from "@visulima/storage/transformers/image";
import express from "express";
import swaggerUi from "swagger-ui-express";
import fs from "node:fs";
import path from "node:path";

const PORT = process.env.PORT || 3002;

const app = express();

// Storage configuration
const storage = new DiskStorage({
    directory: "./uploads",
    maxUploadSize: "100MB",
});

// Generate OpenAPI spec from storage package
const xhrSpec = xhrOpenApiSpec(`http://localhost:${PORT}`, "/files", {
    transformer: "image",
    supportedTransformerFormat: ["jpeg", "png", "webp", "avif", "tiff", "gif"],
});
const transformSpec = transformOpenApiSpec("/files", ["Transform"]);

const swaggerSpec = {
    openapi: "3.0.0",
    info: {
        title: "Visulima Upload Express API",
        version: "1.0.0",
        contact: {
            name: "Visulima",
            url: "https://github.com/visulima/visulima",
        },
    },
    servers: [
        {
            url: `http://localhost:${PORT}`,
            description: "Development server",
        },
    ],
    components: {
        schemas: {
            ...xhrSpec.components?.schemas,
            ...transformSpec.components?.schemas,
        },
        examples: {
            ...xhrSpec.components?.examples,
            ...transformSpec.components?.examples,
        },
        responses: {
            ...xhrSpec.components?.responses,
            ...transformSpec.components?.responses,
        },
        parameters: {
            ...xhrSpec.components?.parameters,
            ...transformSpec.components?.parameters,
        },
    },
    paths: {
        ...xhrSpec.paths,
        ...transformSpec.paths,
    },
};

// Serve swagger
app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
        explorer: true,
        swaggerOptions: {
            validatorUrl: null,
        },
    }),
);

type Moving = { percent: number; status: "moving" | "error" | "done" };

const processes = new Map<string, Moving>();

const uploadDirectory = "upload";
const moveTo = "files";

const imageTransformer = new ImageTransformer(storage, {
    maxImageSize: 10 * 1024 * 1024, // 10MB
    cacheTtl: 3600, // 1 hour
});

const onComplete: express.RequestHandler = (req, res) => {
    const file = (req as express.Request & { body: UploadFile }).body;

    // Sanitize file.name and file.originalName to prevent path traversal
    const safeName = path.basename(file.name || file.id);
    const safeOriginalName = path.basename(file.originalName || file.name || file.id);

    if (!safeName || !safeOriginalName) {
        return res.status(400).json({ error: "Invalid filename." });
    }

    let moving = processes.get(safeName);
    if (!moving) {
        moving = { percent: 0 } as Moving;
        processes.set(safeName, moving);
    }

    if (!moving.status) {
        moving.status = "moving";
        const source = path.resolve(uploadDirectory, safeName);
        const destination = path.resolve(moveTo, safeOriginalName);
        void (async () => {
            try {
                // Copy file with progress tracking
                await fs.promises.copyFile(source, destination);
                await fs.promises.unlink(source);
                moving.status = "done";
                moving.percent = 100;
                processes.set(safeName, moving);
            } catch (e) {
                console.error(e);
                moving.status = "error";
                processes.set(safeName, moving);
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

// Upload endpoint - multipart/form-data file upload with progress tracking
app.use("/files", multipart.handle, onComplete);

// Get file or transform image - supports query parameters for transformations
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

// Legacy endpoint: Resize image (deprecated - use GET /files/{id} with query params instead)
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

// Legacy endpoint: Crop image (deprecated - use GET /files/{id} with query params instead)
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

// Legacy endpoint: Rotate image (deprecated - use GET /files/{id} with query params instead)
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
