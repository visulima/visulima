import type { OpenAPIV3 } from "openapi-types";

type TransformType = boolean | "audio" | "video" | "image";

const FileMetaExample: OpenAPIV3.ExampleObject = {
    value: {
        createdAt: "2022-12-16T10:35:17.466Z",
        id: "391c9157ec481ac6-f72b2d884632d7e6-cdeb2056546033e3",
        modifiedAt: "2022-12-16T10:35:17.470Z",
    },
};

// Helper function to get transformation parameters based on transform type
const getTransformationParameters = (
    transform?: TransformType,
    format: string[] = ["jpeg", "png", "webp", "avif", "tiff", "gif", "mp4", "webm", "mkv", "ogg", "mp3", "wav", "aac", "flac"],
): OpenAPIV3.ParameterObject[] => {
    if (!transform)
        return [];

    // Common parameters supported by all media types
    const commonParameters: OpenAPIV3.ParameterObject[] = [
        {
            description: "Output format for the transformed media",
            in: "query",
            name: "format",
            schema: {
                enum: format,
                type: "string",
            },
        },
        {
            description: "Quality setting (0-100 for images, affects compression)",
            in: "query",
            name: "quality",
            schema: {
                maximum: 100,
                minimum: 1,
                type: "integer",
            },
        },
    ];

    // Image and video specific parameters
    const imageVideoParameters: OpenAPIV3.ParameterObject[] = [
        {
            description: "Desired width in pixels",
            in: "query",
            name: "width",
            schema: {
                minimum: 1,
                type: "integer",
            },
        },
        {
            description: "Desired height in pixels",
            in: "query",
            name: "height",
            schema: {
                minimum: 1,
                type: "integer",
            },
        },
        {
            description: "Resize fit mode",
            in: "query",
            name: "fit",
            schema: {
                enum: ["cover", "contain", "fill", "inside", "outside"],
                type: "string",
            },
        },
        {
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
        {
            description: "Avoid enlarging images smaller than specified dimensions",
            in: "query",
            name: "withoutEnlargement",
            schema: {
                type: "boolean",
            },
        },
        {
            description: "Avoid reducing images larger than specified dimensions",
            in: "query",
            name: "withoutReduction",
            schema: {
                type: "boolean",
            },
        },
        // Crop parameters
        {
            description: "Crop area left offset",
            in: "query",
            name: "left",
            schema: {
                minimum: 0,
                type: "integer",
            },
        },
        {
            description: "Crop area top offset",
            in: "query",
            name: "top",
            schema: {
                minimum: 0,
                type: "integer",
            },
        },
        {
            description: "Crop area width",
            in: "query",
            name: "cropWidth",
            schema: {
                minimum: 1,
                type: "integer",
            },
        },
        {
            description: "Crop area height",
            in: "query",
            name: "cropHeight",
            schema: {
                minimum: 1,
                type: "integer",
            },
        },
        {
            description: "Rotation angle in degrees",
            in: "query",
            name: "angle",
            schema: {
                enum: [90, 180, 270],
                type: "integer",
            },
        },
        {
            description: "Background color for rotation (hex, rgb, or color name)",
            in: "query",
            name: "background",
            schema: {
                type: "string",
            },
        },
    ];

    // Video and audio specific parameters
    const videoAudioParameters: OpenAPIV3.ParameterObject[] = [
        {
            description: "Target bitrate in bits per second",
            in: "query",
            name: "bitrate",
            schema: {
                minimum: 1,
                type: "integer",
            },
        },
        {
            description: "Video or audio codec",
            in: "query",
            name: "codec",
            schema: {
                enum: ["avc", "hevc", "vp8", "vp9", "av1", "aac", "opus", "mp3", "vorbis", "flac"],
                type: "string",
            },
        },
    ];

    // Video specific parameters
    const videoParameters: OpenAPIV3.ParameterObject[] = [
        {
            description: "Video frame rate in Hz",
            in: "query",
            name: "frameRate",
            schema: {
                minimum: 1,
                type: "number",
            },
        },
        {
            description: "Video key frame interval in seconds",
            in: "query",
            name: "keyFrameInterval",
            schema: {
                minimum: 0.1,
                type: "number",
            },
        },
    ];

    // Audio specific parameters
    const audioParameters: OpenAPIV3.ParameterObject[] = [
        {
            description: "Audio channel count",
            in: "query",
            name: "numberOfChannels",
            schema: {
                enum: [1, 2, 3, 4, 5, 6, 7, 8],
                type: "integer",
            },
        },
        {
            description: "Audio sample rate in Hz",
            in: "query",
            name: "sampleRate",
            schema: {
                enum: [8000, 11_025, 16_000, 22_050, 32_000, 44_100, 48_000, 88_200, 96_000, 192_000],
                type: "integer",
            },
        },
    ];

    // Combine parameters based on transform type
    let parameters: OpenAPIV3.ParameterObject[] = [];

    if (transform === true || transform === "image" || transform === "video") {
        parameters = [...parameters, ...commonParameters, ...imageVideoParameters];
    } else if (transform === "audio") {
        parameters = [...parameters, ...commonParameters];
    }

    if (transform === true || transform === "video" || transform === "audio") {
        parameters = [...parameters, ...videoAudioParameters];
    }

    if (transform === true || transform === "video") {
        parameters = [...parameters, ...videoParameters];
    }

    if (transform === true || transform === "audio") {
        parameters = [...parameters, ...audioParameters];
    }

    // Remove duplicates (in case of overlapping parameters)
    const seen = new Set<string>();

    return parameters.filter((parameter) => {
        if (seen.has(parameter.name)) {
            return false;
        }

        seen.add(parameter.name);

        return true;
    });
};

// Helper function to get transformation response headers
const getTransformationHeaders = (transform?: TransformType): Record<string, OpenAPIV3.HeaderObject> => {
    if (!transform)
        return {};

    const headers: Record<string, OpenAPIV3.HeaderObject> = {
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
    };

    return headers;
};

// Helper function to get transformation error responses
const getTransformationErrorResponses = (transform?: TransformType): Record<string, OpenAPIV3.ResponseObject> => {
    if (!transform)
        return {};

    return {
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
    };
};

export const sharedGet = (
    operationId: string,
    tags: string[] | undefined,
    transform?: TransformType,
    transformerFormat?: string[],
): OpenAPIV3.OperationObject => {
    return {
        description: "Get the uploaded file with optional media transformation support",
        operationId,
        parameters: [
            {
                in: "path",
                name: "id",
                required: true,
                schema: {
                    type: "string",
                },
            },
            ...getTransformationParameters(transform, transformerFormat),
        ],
        responses: {
            200: {
                content: {
                    "*/*": {
                        schema: {
                            description: transform ? "Transformed file content" : "File content",
                            format: "binary",
                            type: "string",
                        },
                    },
                },
                description: transform ? "File retrieved and transformed successfully" : "File retrieved successfully",
                headers: {
                    "Content-Type": {
                        description: `MIME type of the file${transform ? " (or transformed file)" : ""}`,
                        schema: {
                            type: "string",
                        },
                    },
                    ETag: {
                        description: `Upload ETag${transform ? " (or transformed file ETag)" : ""}`,
                        schema: {
                            example: "d41d8cd98f00b204e9800998ecf8427e",
                            type: "string",
                        },
                    },
                    "Last-Modified": {
                        description: "Upload last modified date",
                        schema: {
                            example: "2021-08-25T11:12:26.635Z",
                            format: "date-time",
                            type: "string",
                        },
                    },
                    ...getTransformationHeaders(transform),
                    "X-Upload-Expires": {
                        description: "Upload expiration date",
                        schema: {
                            example: "2021-08-25T11:12:26.635Z",
                            format: "date-time",
                            type: "string",
                        },
                    },
                },
            },
            ...getTransformationErrorResponses(transform),
            404: {
                content: {
                    "application/json": {
                        example: {
                            error: {
                                code: "FileNotFound",
                                message: "Not found",
                            },
                        },
                        schema: {
                            $ref: "#/components/schemas/Error",
                        },
                    },
                },
                description: "Not Found",
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
        summary: "Get the uploaded file",
        tags,
    };
};

export const sharedGetMeta = (operationId: string, tags: string[] | undefined): OpenAPIV3.OperationObject => {
    return {
        description: "Get the uploaded file metadata",
        operationId,
        parameters: [
            {
                in: "path",
                name: "id",
                required: true,
                schema: {
                    type: "string",
                },
            },
        ],
        responses: {
            200: {
                content: {
                    "application/json": {
                        schema: {
                            $ref: "#/components/schemas/FileMeta",
                        },
                    },
                },
                description: "OK",
                headers: {
                    "Last-Modified": {
                        description: "Upload last modified date",
                        schema: {
                            example: "2021-08-25T11:12:26.635Z",
                            format: "date-time",
                            type: "string",
                        },
                    },
                    "X-Upload-Expires": {
                        description: "Upload expiration date",
                        schema: {
                            example: "2021-08-25T11:12:26.635Z",
                            format: "date-time",
                            type: "string",
                        },
                    },
                },
            },
            404: {
                content: {
                    "application/json": {
                        example: {
                            error: {
                                code: "FileNotFound",
                                message: "File metadata not found",
                            },
                        },
                        schema: {
                            $ref: "#/components/schemas/Error",
                        },
                    },
                },
                description: "Not Found",
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
        summary: "Get the uploaded file metadata",
        tags,
    };
};

export const sharedErrorSchemaObject: Record<string, OpenAPIV3.NonArraySchemaObject> = {
    Error: {
        description: "Error",
        properties: {
            error: {
                properties: {
                    code: {
                        minLength: 1,
                        type: "string",
                    },
                    message: {
                        minLength: 1,
                        type: "string",
                    },
                    name: {
                        minLength: 3,
                        type: "string",
                    },
                },
                required: ["message"],
                type: "object",
            },
        },
        required: ["error"],
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
};

export const sharedFileMetaSchemaObject: Record<string, OpenAPIV3.NonArraySchemaObject> = {
    FileMeta: {
        description: "File meta",
        properties: {
            bytesWritten: {
                type: "integer",
            },
            contentType: {
                type: "string",
            },
            createdAt: {
                format: "date-time",
                type: "string",
            },
            id: {
                minLength: 1,
                type: "string",
            },
            metadata: {
                type: "object",
            },
            name: {
                minLength: 1,
                type: "string",
            },
            originalName: {
                minLength: 1,
                type: "string",
            },
            status: {
                enum: ["completed", "part", "deleted", "created"],
                type: "string",
            },
        },
        type: "object",
    },
};

export const sharedFileMetaExampleObject: Record<string, OpenAPIV3.ExampleObject> = {
    FileMeta: {
        value: [FileMetaExample],
    },
    FileMetaPagination: {
        value: {
            data: [FileMetaExample.value],
            meta: {
                firstPage: 1,
                firstPageUrl: "/?page=1",
                lastPage: 1,
                lastPageUrl: "/?page=10",
                nextPageUrl: "/?page=2",
                page: 1,
                perPage: 1,
                previousPageUrl: undefined,
                total: 1,
            },
        },
    },
};

export const sharedGetList = (operationId: string, tags: string[] | undefined): OpenAPIV3.OperationObject => {
    return {
        description: "List upload",
        operationId,
        parameters: [
            {
                description: "Maximum number of elements to retrieve.",
                in: "query",
                name: "limit",
                schema: {
                    nullable: true,
                    type: "integer",
                },
            },
            {
                description: "Page number. Use only for pagination.",
                in: "query",
                name: "page",
                schema: {
                    nullable: true,
                    type: "integer",
                },
            },
        ],
        responses: {
            200: {
                content: {
                    "application/json": {
                        examples: {
                            Default: {
                                $ref: "#/components/examples/FileMeta",
                            },
                            Pagination: {
                                $ref: "#/components/examples/FileMetaPagination",
                            },
                        },
                        schema: {
                            $ref: "#/components/schemas/FileMeta",
                        },
                    },
                },
                description: "OK",
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

        summary: "List upload",
        tags,
    };
};
