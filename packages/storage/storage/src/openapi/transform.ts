import { createHash } from "node:crypto";

import { createPaginationMetaSchemaObject, createPaginationSchemaObject } from "@visulima/pagination";
import type { OpenAPIV3 } from "openapi-types";

import { sharedErrorSchemaObject, sharedFileMetaExampleObject, sharedFileMetaSchemaObject } from "./shared";

const swaggerSpec = (path = "/", tags: string[] | undefined = ["Transform"]): Partial<OpenAPIV3.Document> => {
    const pathHash = createHash("sha256").update(path).digest("base64");

    return {
        components: {
            examples: sharedFileMetaExampleObject,
            parameters: {
                Affine: {
                    description: "Apply affine transformation",
                    in: "query",
                    name: "affine",
                    schema: {
                        type: "boolean",
                    },
                },
                Angle: {
                    description: "Rotation angle in degrees. Note: angles other than 90°, 180°, and 270° require interpolation and may affect quality",
                    in: "query",
                    name: "angle",
                    schema: {
                        type: "number",
                    },
                },
                Background: {
                    description: "Background color for rotation (hex, rgb, or color name)",
                    in: "query",
                    name: "background",
                    schema: {
                        type: "string",
                    },
                },
                Bitrate: {
                    description: "Target bitrate in bits per second",
                    in: "query",
                    name: "bitrate",
                    schema: {
                        minimum: 1,
                        type: "integer",
                    },
                },
                Blur: {
                    description: "Apply blur effect",
                    in: "query",
                    name: "blur",
                    schema: {
                        type: "boolean",
                    },
                },
                Brightness: {
                    description: "Brightness multiplier for modulation",
                    in: "query",
                    name: "brightness",
                    schema: {
                        type: "number",
                    },
                },
                Clahe: {
                    description: "Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)",
                    in: "query",
                    name: "clahe",
                    schema: {
                        type: "boolean",
                    },
                },
                // Video/Audio parameters
                Codec: {
                    description: "Video or audio codec",
                    in: "query",
                    name: "codec",
                    schema: {
                        enum: ["avc", "hevc", "vp8", "vp9", "av1", "aac", "opus", "mp3", "vorbis", "flac"],
                        type: "string",
                    },
                },
                Colourspace: {
                    description: "Convert colourspace",
                    in: "query",
                    name: "colourspace",
                    schema: {
                        enum: ["srgb", "rgb", "cmyk", "lab", "b-w"],
                        type: "string",
                    },
                },
                CropHeight: {
                    description: "Crop area height",
                    in: "query",
                    name: "cropHeight",
                    schema: {
                        minimum: 1,
                        type: "integer",
                    },
                },
                CropWidth: {
                    description: "Crop area width",
                    in: "query",
                    name: "cropWidth",
                    schema: {
                        minimum: 1,
                        type: "integer",
                    },
                },
                Dilate: {
                    description: "Apply dilation",
                    in: "query",
                    name: "dilate",
                    schema: {
                        type: "boolean",
                    },
                },
                EnsureAlpha: {
                    description: "Ensure alpha channel",
                    in: "query",
                    name: "ensureAlpha",
                    schema: {
                        type: "boolean",
                    },
                },
                Erode: {
                    description: "Apply erosion",
                    in: "query",
                    name: "erode",
                    schema: {
                        type: "boolean",
                    },
                },
                FastShrinkOnLoad: {
                    description: "Fast shrink on load for large images",
                    in: "query",
                    name: "fastShrinkOnLoad",
                    schema: {
                        type: "boolean",
                    },
                },
                FileID: {
                    description: "File identifier",
                    in: "path",
                    name: "id",
                    required: true,
                    schema: {
                        type: "string",
                    },
                },
                Fit: {
                    description: "Resize fit mode",
                    in: "query",
                    name: "fit",
                    schema: {
                        enum: ["cover", "contain", "fill", "inside", "outside"],
                        type: "string",
                    },
                },
                Flatten: {
                    description: "Flatten alpha channel",
                    in: "query",
                    name: "flatten",
                    schema: {
                        type: "boolean",
                    },
                },
                Flip: {
                    description: "Flip image vertically",
                    in: "query",
                    name: "flip",
                    schema: {
                        type: "boolean",
                    },
                },
                Flop: {
                    description: "Flop image horizontally",
                    in: "query",
                    name: "flop",
                    schema: {
                        type: "boolean",
                    },
                },
                // Common transformation parameters
                Format: {
                    description: "Output format for the transformed media",
                    in: "query",
                    name: "format",
                    schema: {
                        enum: ["jpeg", "png", "webp", "avif", "tiff", "gif", "mp4", "webm", "mkv", "ogg", "mp3", "wav", "aac", "flac"],
                        type: "string",
                    },
                },
                FrameRate: {
                    description: "Video frame rate in Hz",
                    in: "query",
                    name: "frameRate",
                    schema: {
                        minimum: 1,
                        type: "number",
                    },
                },
                Gamma: {
                    description: "Apply gamma correction",
                    in: "query",
                    name: "gamma",
                    schema: {
                        type: "boolean",
                    },
                },
                Greyscale: {
                    description: "Convert to greyscale",
                    in: "query",
                    name: "greyscale",
                    schema: {
                        type: "boolean",
                    },
                },
                Height: {
                    description: "Desired height in pixels",
                    in: "query",
                    name: "height",
                    schema: {
                        minimum: 1,
                        type: "integer",
                    },
                },
                Hue: {
                    description: "Hue rotation in degrees for modulation",
                    in: "query",
                    name: "hue",
                    schema: {
                        type: "integer",
                    },
                },
                Kernel: {
                    description: "Resize kernel algorithm",
                    in: "query",
                    name: "kernel",
                    schema: {
                        enum: ["nearest", "cubic", "mitchell", "lanczos2", "lanczos3"],
                        type: "string",
                    },
                },
                KeyFrameInterval: {
                    description: "Video key frame interval in seconds",
                    in: "query",
                    name: "keyFrameInterval",
                    schema: {
                        minimum: 0.1,
                        type: "number",
                    },
                },
                // Crop parameters
                Left: {
                    description: "Crop area left offset",
                    in: "query",
                    name: "left",
                    schema: {
                        minimum: 0,
                        type: "integer",
                    },
                },
                Lightness: {
                    description: "Lightness adjustment for modulation",
                    in: "query",
                    name: "lightness",
                    schema: {
                        type: "integer",
                    },
                },
                Median: {
                    description: "Apply median filter with specified size",
                    in: "query",
                    name: "median",
                    schema: {
                        minimum: 1,
                        type: "integer",
                    },
                },
                Modulate: {
                    description: "Apply modulation effects",
                    in: "query",
                    name: "modulate",
                    schema: {
                        type: "boolean",
                    },
                },
                Negate: {
                    description: "Negate (invert) the image",
                    in: "query",
                    name: "negate",
                    schema: {
                        type: "boolean",
                    },
                },
                Normalise: {
                    description: "Normalise the image",
                    in: "query",
                    name: "normalise",
                    schema: {
                        type: "boolean",
                    },
                },
                NumberOfChannels: {
                    description: "Audio channel count",
                    in: "query",
                    name: "numberOfChannels",
                    schema: {
                        enum: [1, 2, 3, 4, 5, 6, 7, 8],
                        type: "integer",
                    },
                },
                PipelineColourspace: {
                    description: "Set pipeline colourspace",
                    in: "query",
                    name: "pipelineColourspace",
                    schema: {
                        type: "boolean",
                    },
                },
                Position: {
                    description: "Position for cover/contain fits",
                    in: "query",
                    name: "position",
                    schema: {
                        oneOf: [
                            {
                                enum: ["top", "right", "bottom", "left", "center"],
                                type: "string",
                            },
                            {
                                minimum: 0,
                                type: "integer",
                            },
                        ],
                    },
                },
                Quality: {
                    description: "Quality setting (0-100 for images, affects compression)",
                    in: "query",
                    name: "quality",
                    schema: {
                        maximum: 100,
                        minimum: 1,
                        type: "integer",
                    },
                },
                RemoveAlpha: {
                    description: "Remove alpha channel",
                    in: "query",
                    name: "removeAlpha",
                    schema: {
                        type: "boolean",
                    },
                },
                SampleRate: {
                    description: "Audio sample rate in Hz",
                    in: "query",
                    name: "sampleRate",
                    schema: {
                        enum: [8000, 11_025, 16_000, 22_050, 32_000, 44_100, 48_000, 88_200, 96_000, 192_000],
                        type: "integer",
                    },
                },
                Saturation: {
                    description: "Saturation multiplier for modulation",
                    in: "query",
                    name: "saturation",
                    schema: {
                        type: "number",
                    },
                },
                Sharpen: {
                    description: "Apply sharpening",
                    in: "query",
                    name: "sharpen",
                    schema: {
                        type: "boolean",
                    },
                },
                Threshold: {
                    description: "Apply thresholding with specified value (0-255)",
                    in: "query",
                    name: "threshold",
                    schema: {
                        maximum: 255,
                        minimum: 0,
                        type: "integer",
                    },
                },
                Tint: {
                    description: "Apply tinting",
                    in: "query",
                    name: "tint",
                    schema: {
                        type: "boolean",
                    },
                },
                ToColourspace: {
                    description: "Convert to colourspace",
                    in: "query",
                    name: "toColourspace",
                    schema: {
                        type: "boolean",
                    },
                },
                Top: {
                    description: "Crop area top offset",
                    in: "query",
                    name: "top",
                    schema: {
                        minimum: 0,
                        type: "integer",
                    },
                },
                Unflatten: {
                    description: "Unflatten alpha channel",
                    in: "query",
                    name: "unflatten",
                    schema: {
                        type: "boolean",
                    },
                },
                // Image transformation parameters
                Width: {
                    description: "Desired width in pixels",
                    in: "query",
                    name: "width",
                    schema: {
                        minimum: 1,
                        type: "integer",
                    },
                },
                WithoutEnlargement: {
                    description: "Avoid enlarging images smaller than specified dimensions",
                    in: "query",
                    name: "withoutEnlargement",
                    schema: {
                        type: "boolean",
                    },
                },
                WithoutReduction: {
                    description: "Avoid reducing images larger than specified dimensions",
                    in: "query",
                    name: "withoutReduction",
                    schema: {
                        type: "boolean",
                    },
                },
            },
            responses: {
                404: {
                    content: {
                        "application/json": {
                            schema: {
                                $ref: "#/components/schemas/Error",
                            },
                        },
                    },
                    description: "Not Found",
                },
            },
            schemas: {
                ...createPaginationSchemaObject(
                    "FileMetaPagination",
                    {
                        $ref: "#/components/schemas/PaginationMeta",
                    },
                    "#/components/schemas/PaginationMeta",
                ),
                ...createPaginationMetaSchemaObject("PaginationMeta"),
                ...sharedErrorSchemaObject,
                ...sharedFileMetaSchemaObject,
                // Media transformation result
                MediaTransformResult: {
                    description: "Result of media transformation",
                    properties: {
                        bitrate: {
                            description: "Bitrate for video/audio (bits per second)",
                            type: "integer",
                        },
                        buffer: {
                            description: "Binary data buffer (not included in JSON response)",
                            type: "string",
                        },
                        duration: {
                            description: "Duration for video/audio in seconds",
                            type: "number",
                        },
                        format: {
                            description: "Output format",
                            type: "string",
                        },
                        height: {
                            description: "Height for image/video in pixels",
                            type: "integer",
                        },
                        mediaType: {
                            description: "Type of media",
                            enum: ["image", "video", "audio"],
                            type: "string",
                        },
                        numberOfChannels: {
                            description: "Audio channel count",
                            type: "integer",
                        },
                        originalFile: {
                            $ref: "#/components/schemas/FileMeta",
                        },
                        sampleRate: {
                            description: "Audio sample rate in Hz",
                            type: "integer",
                        },
                        size: {
                            description: "File size in bytes",
                            type: "integer",
                        },
                        width: {
                            description: "Width for image/video in pixels",
                            type: "integer",
                        },
                    },
                    required: ["format", "mediaType", "originalFile", "size"],
                    type: "object",
                },
                // Validation error schema
                ValidationError: {
                    description: "Validation error response",
                    properties: {
                        code: {
                            enum: [
                                "INVALID_PARAMS_FOR_IMAGE",
                                "INVALID_PARAMS_FOR_VIDEO",
                                "INVALID_PARAMS_FOR_AUDIO",
                                "INVALID_FIT_VALUE",
                                "INVALID_ANGLE_VALUE",
                                "INVALID_FORMAT",
                                "INCOMPLETE_CROP_PARAMS",
                                "INVALID_VIDEO_CODEC",
                                "INVALID_VIDEO_FORMAT",
                                "INVALID_WIDTH",
                                "INVALID_HEIGHT",
                                "INVALID_BITRATE",
                                "INVALID_FRAME_RATE",
                                "INVALID_KEY_FRAME_INTERVAL",
                                "INVALID_AUDIO_CODEC",
                                "INVALID_AUDIO_FORMAT",
                                "INVALID_CHANNEL_COUNT",
                                "INVALID_SAMPLE_RATE",
                            ],
                            type: "string",
                        },
                        details: {
                            properties: {
                                invalidParams: {
                                    items: {
                                        type: "string",
                                    },
                                    type: "array",
                                },
                                mediaType: {
                                    enum: ["image", "video", "audio"],
                                    type: "string",
                                },
                                suggestions: {
                                    items: {
                                        type: "string",
                                    },
                                    type: "array",
                                },
                                validParams: {
                                    items: {
                                        type: "string",
                                    },
                                    type: "array",
                                },
                            },
                            required: ["invalidParams", "validParams", "mediaType"],
                            type: "object",
                        },
                        message: {
                            type: "string",
                        },
                        name: {
                            enum: ["ValidationError"],
                            type: "string",
                        },
                    },
                    required: ["code", "details", "message", "name"],
                    type: "object",
                },
            },
        },
        paths: {
            [`${path.replace(/\/$/, "")}/{id}/transform`]: {
                get: {
                    description:
                        "Get transformation metadata for a file without downloading. Returns information about supported transformations and current file properties.",
                    operationId: `${pathHash}TransformGetMetadata`,
                    parameters: [
                        {
                            $ref: "#/components/parameters/FileID",
                        },
                    ],
                    responses: {
                        200: {
                            content: {
                                "application/json": {
                                    schema: {
                                        description: "File transformation metadata",
                                        properties: {
                                            bitrate: {
                                                description: "Current bitrate for video/audio",
                                                type: "integer",
                                            },
                                            dimensions: {
                                                description: "Dimensions for image/video",
                                                properties: {
                                                    height: {
                                                        type: "integer",
                                                    },
                                                    width: {
                                                        type: "integer",
                                                    },
                                                },
                                                type: "object",
                                            },
                                            duration: {
                                                description: "Duration for video/audio in seconds",
                                                type: "number",
                                            },
                                            mediaType: {
                                                description: "Detected media type",
                                                enum: ["image", "video", "audio"],
                                                type: "string",
                                            },
                                            numberOfChannels: {
                                                description: "Current channel count for audio",
                                                type: "integer",
                                            },
                                            originalFormat: {
                                                description: "Original file format",
                                                type: "string",
                                            },
                                            sampleRate: {
                                                description: "Current sample rate for audio",
                                                type: "integer",
                                            },
                                            supportedFormats: {
                                                description: "Supported output formats for this media type",
                                                items: {
                                                    type: "string",
                                                },
                                                type: "array",
                                            },
                                            supportedParameters: {
                                                description: "Supported transformation parameters",
                                                items: {
                                                    type: "string",
                                                },
                                                type: "array",
                                            },
                                        },
                                        required: ["mediaType", "supportedFormats", "supportedParameters"],
                                        type: "object",
                                    },
                                },
                            },
                            description: "Transformation metadata",
                        },
                        404: {
                            $ref: "#/components/responses/404",
                        },
                        default: {
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                            description: "Error",
                        },
                    },
                    summary: "Get transformation metadata",
                    tags,
                },
            },
            [`${path.replace(/\/$/, "")}/{id}`]: {
                get: {
                    description:
                        "Retrieve and transform a file with optional media transformations. Supports resizing, cropping, format conversion, and codec changes based on query parameters.",
                    operationId: `${pathHash}TransformGetFile`,
                    parameters: [
                        {
                            $ref: "#/components/parameters/FileID",
                        },
                        // Common parameters
                        {
                            $ref: "#/components/parameters/Format",
                        },
                        {
                            $ref: "#/components/parameters/Quality",
                        },
                        // Image/Video parameters
                        {
                            $ref: "#/components/parameters/Width",
                        },
                        {
                            $ref: "#/components/parameters/Height",
                        },
                        {
                            $ref: "#/components/parameters/Fit",
                        },
                        {
                            $ref: "#/components/parameters/Position",
                        },
                        {
                            $ref: "#/components/parameters/WithoutEnlargement",
                        },
                        {
                            $ref: "#/components/parameters/WithoutReduction",
                        },
                        // Crop parameters
                        {
                            $ref: "#/components/parameters/Left",
                        },
                        {
                            $ref: "#/components/parameters/Top",
                        },
                        {
                            $ref: "#/components/parameters/CropWidth",
                        },
                        {
                            $ref: "#/components/parameters/CropHeight",
                        },
                        {
                            $ref: "#/components/parameters/Angle",
                        },
                        {
                            $ref: "#/components/parameters/Background",
                        },
                        // Resize parameters
                        {
                            $ref: "#/components/parameters/Kernel",
                        },
                        {
                            $ref: "#/components/parameters/FastShrinkOnLoad",
                        },
                        // Image operations
                        {
                            $ref: "#/components/parameters/Blur",
                        },
                        {
                            $ref: "#/components/parameters/Sharpen",
                        },
                        {
                            $ref: "#/components/parameters/Median",
                        },
                        {
                            $ref: "#/components/parameters/Clahe",
                        },
                        {
                            $ref: "#/components/parameters/Threshold",
                        },
                        {
                            $ref: "#/components/parameters/Gamma",
                        },
                        {
                            $ref: "#/components/parameters/Negate",
                        },
                        {
                            $ref: "#/components/parameters/Normalise",
                        },
                        {
                            $ref: "#/components/parameters/Flatten",
                        },
                        {
                            $ref: "#/components/parameters/Unflatten",
                        },
                        {
                            $ref: "#/components/parameters/Flip",
                        },
                        {
                            $ref: "#/components/parameters/Flop",
                        },
                        {
                            $ref: "#/components/parameters/Greyscale",
                        },
                        {
                            $ref: "#/components/parameters/Modulate",
                        },
                        {
                            $ref: "#/components/parameters/Brightness",
                        },
                        {
                            $ref: "#/components/parameters/Saturation",
                        },
                        {
                            $ref: "#/components/parameters/Hue",
                        },
                        {
                            $ref: "#/components/parameters/Lightness",
                        },
                        {
                            $ref: "#/components/parameters/Tint",
                        },
                        {
                            $ref: "#/components/parameters/Colourspace",
                        },
                        {
                            $ref: "#/components/parameters/Affine",
                        },
                        {
                            $ref: "#/components/parameters/Dilate",
                        },
                        {
                            $ref: "#/components/parameters/Erode",
                        },
                        {
                            $ref: "#/components/parameters/PipelineColourspace",
                        },
                        {
                            $ref: "#/components/parameters/ToColourspace",
                        },
                        {
                            $ref: "#/components/parameters/RemoveAlpha",
                        },
                        {
                            $ref: "#/components/parameters/EnsureAlpha",
                        },
                        // Video/Audio parameters
                        {
                            $ref: "#/components/parameters/Codec",
                        },
                        {
                            $ref: "#/components/parameters/Bitrate",
                        },
                        {
                            $ref: "#/components/parameters/FrameRate",
                        },
                        {
                            $ref: "#/components/parameters/KeyFrameInterval",
                        },
                        {
                            $ref: "#/components/parameters/NumberOfChannels",
                        },
                        {
                            $ref: "#/components/parameters/SampleRate",
                        },
                    ],
                    responses: {
                        200: {
                            content: {
                                "*/*": {
                                    schema: {
                                        description: "Transformed media file",
                                        format: "binary",
                                        type: "string",
                                    },
                                },
                            },
                            description: "Transformed file returned successfully",
                            headers: {
                                "Content-Type": {
                                    description: "MIME type of the transformed file",
                                    schema: {
                                        type: "string",
                                    },
                                },
                                ETag: {
                                    description: "ETag of the transformed file",
                                    schema: {
                                        type: "string",
                                    },
                                },
                                "X-Media-Type": {
                                    description: "Type of media (image/video/audio)",
                                    schema: {
                                        enum: ["image", "video", "audio"],
                                        type: "string",
                                    },
                                },
                                "X-Original-Format": {
                                    description: "Original file format",
                                    schema: {
                                        type: "string",
                                    },
                                },
                                "X-Transformed-Format": {
                                    description: "Transformed file format",
                                    schema: {
                                        type: "string",
                                    },
                                },
                            },
                        },
                        400: {
                            content: {
                                "application/json": {
                                    examples: {
                                        ValidationError: {
                                            value: {
                                                error: {
                                                    code: "INVALID_PARAMS_FOR_IMAGE",
                                                    details: {
                                                        invalidParams: ["codec", "bitrate"],
                                                        mediaType: "image",
                                                        validParams: [
                                                            "format",
                                                            "quality",
                                                            "width",
                                                            "height",
                                                            "fit",
                                                            "position",
                                                            "withoutEnlargement",
                                                            "withoutReduction",
                                                            "left",
                                                            "top",
                                                            "cropWidth",
                                                            "cropHeight",
                                                            "angle",
                                                            "background",
                                                        ],
                                                    },
                                                    message:
                                                        "Invalid query parameters for image transformation: codec, bitrate. Images support: format, quality, width, height, fit, position, withoutEnlargement, withoutReduction, left, top, cropWidth, cropHeight, angle, background. Video/audio parameters (codec, bitrate) are not supported for images.",
                                                    name: "ValidationError",
                                                },
                                            },
                                        },
                                    },
                                    schema: {
                                        $ref: "#/components/schemas/ValidationError",
                                    },
                                },
                            },
                            description: "Invalid transformation parameters",
                        },
                        404: {
                            $ref: "#/components/responses/404",
                        },
                        413: {
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                            description: "File too large for transformation",
                        },
                        415: {
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                            description: "Unsupported media type for transformation",
                        },
                        default: {
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                            description: "Error",
                        },
                    },
                    summary: "Transform and retrieve file",
                    tags,
                },
            },
        },
    };
};

export default swaggerSpec;
