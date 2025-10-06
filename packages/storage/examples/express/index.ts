import { File as DiskFile, DiskStorage, ImageTransformer, Multipart } from "@visulima/upload";
import { copyFile } from "copy-file";
import express from "express";
import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";
import fs from "node:fs";
import path from "node:path";

const PORT = process.env.PORT || 3002;

const app = express();

// Swagger definition
const swaggerDefinition = {
    openapi: "3.0.0",
    info: {
        title: "Visulima Upload Express API",
        version: "1.0.0",
        description: "File upload and image transformation API built with Express and Visulima Upload",
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
            File: {
                type: "object",
                properties: {
                    id: {
                        type: "string",
                        description: "Unique file identifier",
                    },
                    name: {
                        type: "string",
                        description: "File name",
                    },
                    originalName: {
                        type: "string",
                        description: "Original file name",
                    },
                    size: {
                        type: "number",
                        description: "File size in bytes",
                    },
                    contentType: {
                        type: "string",
                        description: "MIME content type",
                    },
                    ETag: {
                        type: "string",
                        description: "ETag for caching",
                    },
                },
            },
            Error: {
                type: "object",
                properties: {
                    error: {
                        type: "string",
                        description: "Error message",
                    },
                },
            },
        },
    },
};

// Options for the swagger docs
const options = {
    swaggerDefinition,
    apis: ["./index.ts"], // Path to the API docs
};

// Initialize swagger-jsdoc
const swaggerSpec = swaggerJSDoc(options);

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

/**
 * @swagger
 * /files:
 *   post:
 *     summary: Upload a file
 *     description: Upload a file using multipart/form-data. The file will be processed and moved to the files directory.
 *     tags: [Upload]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File to upload
 *     responses:
 *       200:
 *         description: File uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/File'
 *                 - type: object
 *                   properties:
 *                     moving:
 *                       type: object
 *                       properties:
 *                         percent:
 *                           type: number
 *                           description: Upload progress percentage
 *                         status:
 *                           type: string
 *                           enum: [moving, error, done]
 *                           description: Current status of file processing
 *       202:
 *         description: File upload in progress
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/File'
 *                 - type: object
 *                   properties:
 *                     moving:
 *                       type: object
 *                       properties:
 *                         percent:
 *                           type: number
 *                           description: Upload progress percentage
 *                         status:
 *                           type: string
 *                           enum: [moving, error, done]
 *                           description: Current status of file processing
 *       422:
 *         description: Upload failed
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/File'
 *                 - type: object
 *                   properties:
 *                     moving:
 *                       type: object
 *                       properties:
 *                         percent:
 *                           type: number
 *                           description: Upload progress percentage
 *                         status:
 *                           type: string
 *                           enum: [moving, error, done]
 *                           description: Current status of file processing
 */
app.use("/files", multipart.upload, onComplete);

/**
 * @swagger
 * /files/{id}:
 *   get:
 *     summary: Get file or transform image
 *     description: Retrieve a file by ID or apply image transformations using query parameters. If no transformation parameters are provided, returns the original file.
 *     tags: [Files, Images]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
 *       - in: query
 *         name: width
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Desired width in pixels
 *       - in: query
 *         name: height
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Desired height in pixels
 *       - in: query
 *         name: fit
 *         schema:
 *           type: string
 *           enum: [cover, contain, fill, inside, outside]
 *         description: Resize fit mode
 *       - in: query
 *         name: position
 *         schema:
 *           type: string
 *           enum: [top, right, bottom, left, center]
 *         description: Position for cover/contain fits
 *       - in: query
 *         name: quality
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Quality setting (0-100)
 *       - in: query
 *         name: lossless
 *         schema:
 *           type: boolean
 *         description: Lossless compression
 *       - in: query
 *         name: effort
 *         schema:
 *           type: integer
 *         description: Compression effort
 *       - in: query
 *         name: alphaQuality
 *         schema:
 *           type: integer
 *         description: Alpha channel quality
 *       - in: query
 *         name: loop
 *         schema:
 *           type: integer
 *         description: Animation loop count
 *       - in: query
 *         name: delay
 *         schema:
 *           type: integer
 *         description: Animation delay
 *     responses:
 *       200:
 *         description: File retrieved successfully
 *         content:
 *           image/*:
 *             schema:
 *               type: string
 *               format: binary
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: File not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Transformation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /images/{id}/resize:
 *   get:
 *     summary: Resize image (Legacy)
 *     description: Resize an image to specified dimensions. This is a legacy endpoint - use GET /files/{id} instead.
 *     deprecated: true
 *     tags: [Images, Legacy]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
 *       - in: query
 *         name: width
 *         schema:
 *           type: integer
 *         description: Desired width in pixels
 *       - in: query
 *         name: height
 *         schema:
 *           type: integer
 *         description: Desired height in pixels
 *       - in: query
 *         name: fit
 *         schema:
 *           type: string
 *           enum: [cover, contain, fill, inside, outside]
 *           default: cover
 *         description: Resize fit mode
 *       - in: query
 *         name: quality
 *         schema:
 *           type: integer
 *           default: 80
 *         description: Quality setting (0-100)
 *     responses:
 *       200:
 *         description: Image resized successfully
 *         content:
 *           image/jpeg:
 *             schema:
 *               type: string
 *               format: binary
 *       500:
 *         description: Resize error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /images/{id}/crop:
 *   get:
 *     summary: Crop image (Legacy)
 *     description: Crop an image to specified dimensions and position. This is a legacy endpoint - use GET /files/{id} instead.
 *     deprecated: true
 *     tags: [Images, Legacy]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
 *       - in: query
 *         name: left
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: Crop area left offset
 *       - in: query
 *         name: top
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: Crop area top offset
 *       - in: query
 *         name: width
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Crop area width
 *       - in: query
 *         name: height
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Crop area height
 *       - in: query
 *         name: quality
 *         schema:
 *           type: integer
 *           default: 80
 *         description: Quality setting (0-100)
 *     responses:
 *       200:
 *         description: Image cropped successfully
 *         content:
 *           image/jpeg:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Missing crop parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Crop error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /images/{id}/rotate:
 *   get:
 *     summary: Rotate image (Legacy)
 *     description: Rotate an image by specified angle. This is a legacy endpoint - use GET /files/{id} instead.
 *     deprecated: true
 *     tags: [Images, Legacy]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
 *       - in: query
 *         name: angle
 *         schema:
 *           type: integer
 *           enum: [90, 180, 270]
 *           default: 90
 *         description: Rotation angle in degrees
 *       - in: query
 *         name: quality
 *         schema:
 *           type: integer
 *           default: 80
 *         description: Quality setting (0-100)
 *     responses:
 *       200:
 *         description: Image rotated successfully
 *         content:
 *           image/jpeg:
 *             schema:
 *               type: string
 *               format: binary
 *       500:
 *         description: Rotate error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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
