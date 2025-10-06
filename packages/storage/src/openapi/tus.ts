import { createHash } from "node:crypto";

import { createPaginationMetaSchemaObject, createPaginationSchemaObject } from "@visulima/pagination";
import type { OpenAPIV3 } from "openapi-types";

import { sharedErrorSchemaObject, sharedFileMetaExampleObject, sharedFileMetaSchemaObject, sharedGet, sharedGetList, sharedGetMeta } from "./shared";

const swaggerSpec = (path = "/", tags: string[] | undefined = ["Tus"]): Partial<OpenAPIV3.Document> => {
    const pathHash = createHash("sha256").update(path).digest("base64");
    const getSchemaObject: OpenAPIV3.OperationObject = sharedGet(`${pathHash}TusGetFile`, tags);

    return {
        components: {
            examples: sharedFileMetaExampleObject,
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
                "Tus-Checksum-Algorithm": {
                    description:
                        "Added by the checksum extension. The Tus-Checksum-Algorithm response header MUST be a comma-separated list of the checksum algorithms supported by the server.",
                    type: "string",
                },
                "Tus-Extension": {
                    description:
                        "The Tus-Extension response header MUST be a comma-separated list of the extensions supported by the Server. If no extensions are supported, the Tus-Extension header MUST be omitted.",
                    type: "string",
                },
                "Tus-Max-Size": {
                    description:
                        "The Tus-Max-Size response header MUST be a non-negative integer indicating the maximum allowed size of an entire upload in bytes. The Server SHOULD set this header if there is a known hard limit.",
                    type: "integer",
                },
                "Tus-Resumable": {
                    description: "Protocol version",
                    enum: ["1.0.0"],
                    type: "string",
                },
                "Tus-Version": {
                    description:
                        "The Tus-Version response header MUST be a comma-separated list of protocol versions supported by the Server. The list MUST be sorted by Server's preference where the first one is the most preferred one.",
                    type: "string",
                },
                "Upload-Checksum": {
                    description:
                        "Added by the checksum extension. The Upload-Checksum request header contains information about the checksum of the current body payload. The header MUST consist of the name of the used checksum algorithm and the Base64 encoded checksum separated by a space.",
                    type: "string",
                },
                "Upload-Length": {
                    description:
                        "The Upload-Length request and response header indicates the size of the entire upload in bytes. The value MUST be a non-negative integer. In the concatenation extension, the Client MUST NOT include the Upload-Length header in the final upload creation",
                    type: "integer",
                },
                "Upload-Offset": {
                    description:
                        "The Upload-Offset request and response header indicates a byte offset within a resource. The value MUST be a non-negative integer.",
                    type: "integer",
                },
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
            },
        },
        paths: {
            [`${path.replace(/\/$/, "")}/{id}/metadata`]: {
                get: {
                    ...sharedGetMeta(`${pathHash}TusGetFileMeta`, tags),
                    parameters: [
                        ...(sharedGetMeta(`${pathHash}TusGetFileMeta`, tags).parameters as (OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject)[]),
                        {
                            description: "Version of the protocol supported by the client",
                            in: "header",
                            name: "Tus-Resumable",
                            required: true,
                            schema: {
                                $ref: "#/components/schemas/Tus-Resumable",
                            },
                        },
                    ],
                },
            },
            [`${path.replace(/\/$/, "")}/{id}`]: {
                delete: {
                    description:
                        "When receiving a DELETE request for an existing upload the Server SHOULD free associated resources and MUST respond with the 204 No Content status confirming that the upload was terminated. For all future requests to this URL, the Server SHOULD respond with the 404 Not Found or 410 Gone status.",
                    operationId: `${pathHash}TusFilesDelete`,
                    parameters: [
                        {
                            in: "path",
                            name: "id",
                            required: true,
                            schema: {
                                type: "string",
                            },
                        },
                        {
                            in: "header",
                            name: "Tus-Resumable",
                            required: true,
                            schema: {
                                $ref: "#/components/schemas/Tus-Resumable",
                            },
                        },
                    ],
                    responses: {
                        204: {
                            description: "Upload was terminated",
                            headers: {
                                "Tus-Resumable": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                            },
                        },
                        412: {
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                            description: "Precondition Failed",
                            headers: {
                                "Tus-Resumable": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                                "Tus-Version": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Version",
                                    },
                                },
                            },
                        },
                    },
                    summary: "Added by the Termination extension.",
                    tags,
                },
                get: {
                    ...getSchemaObject,
                    parameters: [
                        ...(getSchemaObject.parameters as (OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject)[]),
                        {
                            description: "Version of the protocol supported by the client",
                            in: "header",
                            name: "Tus-Resumable",
                            required: true,
                            schema: {
                                $ref: "#/components/schemas/Tus-Resumable",
                            },
                        },
                    ],
                },
                head: {
                    description: "Used to determine the offset at which the upload should be continued.",
                    operationId: `${pathHash}TusFilesHead`,
                    parameters: [
                        {
                            in: "path",
                            name: "id",
                            required: true,
                            schema: {
                                type: "string",
                            },
                        },
                        {
                            in: "header",
                            name: "Tus-Resumable",
                            required: true,
                            schema: {
                                $ref: "#/components/schemas/Tus-Resumable",
                            },
                        },
                    ],
                    responses: {
                        200: {
                            description: "Returns offset",
                            headers: {
                                "Cache-Control": {
                                    schema: {
                                        enum: ["no-store"],
                                        type: "string",
                                    },
                                },
                                "Tus-Resumable": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                                "Upload-Length": {
                                    schema: {
                                        $ref: "#/components/schemas/Upload-Length",
                                    },
                                },
                                "Upload-Offset": {
                                    schema: {
                                        $ref: "#/components/schemas/Upload-Offset",
                                    },
                                },
                            },
                        },
                        403: {
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                            description:
                                "If the resource is not found, the Server SHOULD return either the 404 Not Found, 410 Gone or 403 Forbidden status without the Upload-Offset header.",
                            headers: {
                                "Tus-Resumable": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                            },
                        },
                        404: {
                            $ref: "#/components/responses/404",
                        },
                        410: {
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                            description:
                                "If the resource is not found, the Server SHOULD return either the 404 Not Found, 410 Gone or 403 Forbidden status without the Upload-Offset header.",
                            headers: {
                                "Tus-Resumable": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                            },
                        },
                        412: {
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                            description: "Precondition Failed",
                            headers: {
                                "Tus-Resumable": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                                "Tus-Version": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Version",
                                    },
                                },
                            },
                        },
                    },
                    summary: "Used to determine the offset at which the upload should be continued.",
                    tags,
                },
                patch: {
                    description:
                        "The Server SHOULD accept PATCH requests against any upload URL and apply the bytes contained in the message at the given offset specified by the Upload-Offset header. All PATCH requests MUST use Content-Type: application/offset+octet-stream, otherwise the server SHOULD return a 415 Unsupported Media Type status.",
                    operationId: `${pathHash}TusFilePatch`,
                    parameters: [
                        {
                            in: "path",
                            name: "id",
                            required: true,
                            schema: {
                                type: "string",
                            },
                        },
                        {
                            in: "header",
                            name: "Tus-Resumable",
                            required: true,
                            schema: {
                                $ref: "#/components/schemas/Tus-Resumable",
                            },
                        },
                        {
                            description: "Length of the body of this request",
                            in: "header",
                            name: "Content-Length",
                            required: true,
                            schema: {
                                type: "integer",
                            },
                        },
                        {
                            in: "header",
                            name: "Upload-Offset",
                            required: true,
                            schema: {
                                $ref: "#/components/schemas/Upload-Offset",
                            },
                        },
                        {
                            in: "header",
                            name: "Upload-Checksum",
                            schema: {
                                $ref: "#/components/schemas/Upload-Checksum",
                            },
                        },
                    ],
                    requestBody: {
                        content: {
                            "application/offset+octet-stream": {
                                schema: {
                                    type: "string",
                                },
                            },
                        },
                        description: "Remaining (possibly partial) content of the file. Required if Content-Length > 0.",
                        required: false,
                    },
                    responses: {
                        204: {
                            description: "Upload offset was updated",
                            headers: {
                                "Tus-Resumable": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                                "Upload-Expires": {
                                    description:
                                        "Added by the expiration extension. The Upload-Expires response header indicates the time after which the unfinished upload expires. A Server MAY wish to remove incomplete upload after a given period of time to prevent abandoned upload from taking up extra storage. The Client SHOULD use this header to determine if an upload is still valid before attempting to resume the upload. This header MUST be included in every PATCH response if the upload is going to expire. If the expiration is known at the creation, the Upload-Expires header MUST be included in the response to the initial POST request. Its value MAY change over time. If a Client does attempt to resume an upload which has since been removed by the Server, the Server SHOULD respond with the 404 Not Found or 410 Gone status. The latter one SHOULD be used if the Server is keeping track of expired upload. In both cases the Client SHOULD start a new upload. The value of the Upload-Expires header MUST be in RFC 7231 datetime format.",
                                    schema: {
                                        type: "string",
                                    },
                                },
                                "Upload-Offset": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                            },
                        },
                        400: {
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                            description: "Added by the checksum extension. The checksum algorithm is not supported by the server",
                            headers: {
                                "Tus-Resumable": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                            },
                        },
                        403: {
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                            description:
                                "In the concatenation extension, the Server MUST respond with the 403 Forbidden status to PATCH requests against a final upload URL and MUST NOT modify the final or its partial upload.",
                            headers: {
                                "Tus-Resumable": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                            },
                        },
                        404: {
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                            description: "PATCH request against a non-existent resource",
                            headers: {
                                "Tus-Resumable": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                            },
                        },
                        409: {
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                            description:
                                "PATCH request with Upload-Offset unequal to the offset of the resource on the server. The Upload-Offset header's value MUST be equal to the current offset of the resource.",
                            headers: {
                                "Tus-Resumable": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                            },
                        },
                        410: {
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                            description: "PATCH request against a non-existent resource",
                            headers: {
                                "Tus-Resumable": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                            },
                        },
                        412: {
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                            description: "Precondition Failed",
                            headers: {
                                "Tus-Resumable": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                                "Tus-Version": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Version",
                                    },
                                },
                            },
                        },
                        415: {
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                            description: "Content-Type was not application/offset+octet-stream",
                            headers: {
                                "Tus-Resumable": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                            },
                        },
                        460: {
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                            description: "Added by the checksum extension. Checksums mismatch",
                            headers: {
                                "Tus-Resumable": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                            },
                        },
                    },
                    summary: "Used to resume the upload",
                    tags,
                },
            },
            [path.trimEnd()]: {
                get: sharedGetList(`${pathHash}TusGetList`, tags),
                options: {
                    operationId: `${pathHash}TusOptions`,
                    responses: {
                        204: {
                            description: "Success",
                            headers: {
                                "Tus-Checksum-Algorithm": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Checksum-Algorithm",
                                    },
                                },
                                "Tus-Extension": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Extension",
                                    },
                                },
                                "Tus-Max-Size": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Max-Size",
                                    },
                                },
                                "Tus-Resumable": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                                "Tus-Version": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Version",
                                    },
                                },
                            },
                        },
                    },
                    summary: "Request to gather information about the Server's current configuration",
                    tags,
                },
                post: {
                    description: "Endpoint for the Creation extension. Modified by the Creation With Upload extension.",
                    operationId: `${pathHash}TusCreate`,
                    parameters: [
                        {
                            description: "Must be 0 for creation extension. May be a positive number for Creation With Upload extension.",
                            in: "header",
                            name: "Content-Length",
                            schema: {
                                type: "integer",
                            },
                        },
                        {
                            in: "header",
                            name: "Upload-Length",
                            schema: {
                                $ref: "#/components/schemas/Upload-Length",
                            },
                        },
                        {
                            in: "header",

                            name: "Tus-Resumable",
                            schema: {
                                $ref: "#/components/schemas/Tus-Resumable",
                            },
                        },
                        {
                            description:
                                "Added by the Creation extension. The Upload-Metadata request and response header MUST consist of one or more comma-separated key-value pairs. The key and value MUST be separated by a space. The key MUST NOT contain spaces and commas and MUST NOT be empty. The key SHOULD be ASCII encoded and the value MUST be Base64 encoded. All keys MUST be unique. The value MAY be empty. In these cases, the space, which would normally separate the key and the value, MAY be left out. Since metadata can contain arbitrary binary values, Servers SHOULD carefully validate metadata values or sanitize them before using them as header values to avoid header smuggling.",
                            in: "header",
                            name: "Upload-Metadata",
                            schema: {
                                type: "string",
                            },
                        },
                        {
                            description:
                                "Added by the Concatenation extension. The Upload-Concat request and response header MUST be set in both partial and final upload creation requests. It indicates whether the upload is either a partial or final upload. If the upload is a partial one, the header value MUST be partial. In the case of a final upload, its value MUST be final followed by a semicolon and a space-separated list of partial upload URLs that will be concatenated. The partial upload URLs MAY be absolute or relative and MUST NOT contain spaces as defined in RFC 3986.",
                            in: "header",
                            name: "Upload-Concat",
                            schema: {
                                type: "string",
                            },
                        },
                        {
                            description:
                                "Added by the Creation Defer Length extension. The Upload-Defer-Length request and response header indicates that the size of the upload is not known currently and will be transferred later. Its value MUST be 1. If the length of an upload is not deferred, this header MUST be omitted.",
                            in: "header",
                            name: "Upload-Defer-Length",
                            schema: {
                                enum: [1],
                                type: "integer",
                            },
                        },
                        {
                            in: "header",
                            name: "Upload-Offset",
                            schema: {
                                $ref: "#/components/schemas/Upload-Offset",
                            },
                        },
                        {
                            in: "header",
                            name: "Upload-Checksum",
                            schema: {
                                $ref: "#/components/schemas/Upload-Checksum",
                            },
                        },
                    ],
                    requestBody: {
                        content: {
                            "application/offset+octet-stream": {
                                schema: {
                                    type: "string",
                                },
                            },
                        },
                        description: "(Possibly partial) content of the file. Required if Content-Length > 0.",
                        required: false,
                    },
                    responses: {
                        201: {
                            description: "Created",
                            headers: {
                                Location: {
                                    description: "Url of the created resource.",
                                    schema: {
                                        type: "string",
                                    },
                                },
                                "Tus-Resumable": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                                "Upload-Expires": {
                                    description:
                                        "Added by the Creation With Upload Extension in combination with the expiration extension. The Upload-Expires response header indicates the time after which the unfinished upload expires. A Server MAY wish to remove incomplete upload after a given period of time to prevent abandoned upload from taking up extra storage. The Client SHOULD use this header to determine if an upload is still valid before attempting to resume the upload. This header MUST be included in every PATCH response if the upload is going to expire. If the expiration is known at the creation, the Upload-Expires header MUST be included in the response to the initial POST request. Its value MAY change over time. If a Client does attempt to resume an upload which has since been removed by the Server, the Server SHOULD respond with the 404 Not Found or 410 Gone status. The latter one SHOULD be used if the Server is keeping track of expired upload. In both cases the Client SHOULD start a new upload. The value of the Upload-Expires header MUST be in RFC 7231 datetime format.",
                                    schema: {
                                        type: "string",
                                    },
                                },
                                "Upload-Offset": {
                                    schema: {
                                        $ref: "#/components/schemas/Upload-Offset",
                                    },
                                },
                            },
                        },
                        400: {
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                            description:
                                "Added by the Creation With Upload Extension in combination with the checksum extension. The checksum algorithm is not supported by the server",
                            headers: {
                                "Tus-Resumable": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                            },
                        },
                        412: {
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },

                            description: "Precondition Failed",
                            headers: {
                                "Tus-Resumable": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                                "Tus-Version": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Version",
                                    },
                                },
                            },
                        },
                        413: {
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                            description:
                                "If the length of the upload exceeds the maximum, which MAY be specified using the Tus-Max-Size header, the Server MUST respond with the 413 Request Entity Too Large status.",
                            headers: {
                                "Tus-Resumable": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                            },
                        },
                        415: {
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                            description: "Added by the Creation With Upload Extension. Content-Type was not application/offset+octet-stream",
                            headers: {
                                "Tus-Resumable": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                            },
                        },
                        460: {
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                            description: "Added by the Creation With Upload Extension in combination with the checksum extension. Checksums mismatch",
                            headers: {
                                "Tus-Resumable": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                            },
                        },
                    },
                    summary:
                        "An empty POST request is used to create a new upload resource. The Upload-Length header indicates the size of the entire upload in bytes. If the Creation With Upload extension is available, the Client MAY include parts of the upload in the initial Creation request",
                    tags,
                },
            },
        },
    };
};

export default swaggerSpec;
