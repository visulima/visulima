import { createPaginationMetaSchemaObject, createPaginationSchemaObject } from "@visulima/pagination";
import { createHash } from "node:crypto";
import type { OpenAPIV3 } from "openapi-types";

import {
    sharedErrorSchemaObject, sharedFileMetaExampleObject, sharedFileMetaSchemaObject, sharedGet, sharedGetList,
} from "./shared-swagger";

const swaggerSpec = (path: string = "/", tags: string[] | undefined = ["Tus"]): Partial<OpenAPIV3.Document> => {
    const pathHash = createHash("sha256").update(path).digest("base64");
    const getSchemaObject: OpenAPIV3.OperationObject = sharedGet(`${pathHash}TusGetFile`, tags);

    return {
        paths: {
            [path.trimEnd()]: {
                post: {
                    tags,
                    operationId: `${pathHash}TusCreate`,
                    summary:
                        // eslint-disable-next-line max-len
                        "An empty POST request is used to create a new upload resource. The Upload-Length header indicates the size of the entire upload in bytes. If the Creation With Upload extension is available, the Client MAY include parts of the upload in the initial Creation request",
                    description: "Endpoint for the Creation extension. Modified by the Creation With Upload extension.",
                    parameters: [
                        {
                            name: "Content-Length",
                            in: "header",
                            description: "Must be 0 for creation extension. May be a positive number for Creation With Upload extension.",
                            schema: {
                                type: "integer",
                            },
                        },
                        {
                            name: "Upload-Length",
                            in: "header",
                            schema: {
                                $ref: "#/components/schemas/Upload-Length",
                            },
                        },
                        {
                            // eslint-disable-next-line radar/no-duplicate-string
                            name: "Tus-Resumable",
                            in: "header",
                            schema: {
                                // eslint-disable-next-line radar/no-duplicate-string
                                $ref: "#/components/schemas/Tus-Resumable",
                            },
                        },
                        {
                            name: "Upload-Metadata",
                            in: "header",
                            description:
                                // eslint-disable-next-line max-len
                                "Added by the Creation extension. The Upload-Metadata request and response header MUST consist of one or more comma-separated key-value pairs. The key and value MUST be separated by a space. The key MUST NOT contain spaces and commas and MUST NOT be empty. The key SHOULD be ASCII encoded and the value MUST be Base64 encoded. All keys MUST be unique. The value MAY be empty. In these cases, the space, which would normally separate the key and the value, MAY be left out. Since metadata can contain arbitrary binary values, Servers SHOULD carefully validate metadata values or sanitize them before using them as header values to avoid header smuggling.",
                            schema: {
                                type: "string",
                            },
                        },
                        {
                            name: "Upload-Concat",
                            in: "header",
                            description:
                                // eslint-disable-next-line max-len
                                "Added by the Concatenation extension. The Upload-Concat request and response header MUST be set in both partial and final upload creation requests. It indicates whether the upload is either a partial or final upload. If the upload is a partial one, the header value MUST be partial. In the case of a final upload, its value MUST be final followed by a semicolon and a space-separated list of partial upload URLs that will be concatenated. The partial upload URLs MAY be absolute or relative and MUST NOT contain spaces as defined in RFC 3986.",
                            schema: {
                                type: "string",
                            },
                        },
                        {
                            name: "Upload-Defer-Length",
                            in: "header",
                            description:
                                // eslint-disable-next-line max-len
                                "Added by the Creation Defer Length extension. The Upload-Defer-Length request and response header indicates that the size of the upload is not known currently and will be transferred later. Its value MUST be 1. If the length of an upload is not deferred, this header MUST be omitted.",
                            schema: {
                                type: "integer",
                                enum: [1],
                            },
                        },
                        {
                            name: "Upload-Offset",
                            in: "header",
                            schema: {
                                // eslint-disable-next-line radar/no-duplicate-string
                                $ref: "#/components/schemas/Upload-Offset",
                            },
                        },
                        {
                            name: "Upload-Checksum",
                            in: "header",
                            schema: {
                                $ref: "#/components/schemas/Upload-Checksum",
                            },
                        },
                    ],
                    requestBody: {
                        description: "(Possibly partial) content of the file. Required if Content-Length > 0.",
                        required: false,
                        content: {
                            "application/offset+octet-stream": {
                                schema: {
                                    type: "string",
                                },
                            },
                        },
                    },
                    responses: {
                        201: {
                            description: "Created",
                            headers: {
                                "Tus-Resumable": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                                "Upload-Offset": {
                                    schema: {
                                        $ref: "#/components/schemas/Upload-Offset",
                                    },
                                },
                                "Upload-Expires": {
                                    description:
                                        // eslint-disable-next-line max-len
                                        "Added by the Creation With Upload Extension in combination with the expiration extension. The Upload-Expires response header indicates the time after which the unfinished upload expires. A Server MAY wish to remove incomplete upload after a given period of time to prevent abandoned upload from taking up extra storage. The Client SHOULD use this header to determine if an upload is still valid before attempting to resume the upload. This header MUST be included in every PATCH response if the upload is going to expire. If the expiration is known at the creation, the Upload-Expires header MUST be included in the response to the initial POST request. Its value MAY change over time. If a Client does attempt to resume an upload which has since been removed by the Server, the Server SHOULD respond with the 404 Not Found or 410 Gone status. The latter one SHOULD be used if the Server is keeping track of expired upload. In both cases the Client SHOULD start a new upload. The value of the Upload-Expires header MUST be in RFC 7231 datetime format.",
                                    schema: {
                                        type: "string",
                                    },
                                },
                                Location: {
                                    description: "Url of the created resource.",
                                    schema: {
                                        type: "string",
                                    },
                                },
                            },
                        },
                        400: {
                            description:
                                // eslint-disable-next-line max-len
                                "Added by the Creation With Upload Extension in combination with the checksum extension. The checksum algorithm is not supported by the server",
                            headers: {
                                "Tus-Resumable": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                            },
                            content: {
                                "application/json": {
                                    schema: {
                                        // eslint-disable-next-line radar/no-duplicate-string
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                        },
                        412: {
                            // eslint-disable-next-line radar/no-duplicate-string
                            description: "Precondition Failed",
                            headers: {
                                // eslint-disable-next-line radar/no-duplicate-string
                                "Tus-Resumable": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                                "Tus-Version": {
                                    schema: {
                                        // eslint-disable-next-line radar/no-duplicate-string
                                        $ref: "#/components/schemas/Tus-Version",
                                    },
                                },
                            },
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                        },
                        413: {
                            description:
                                // eslint-disable-next-line max-len
                                "If the length of the upload exceeds the maximum, which MAY be specified using the Tus-Max-Size header, the Server MUST respond with the 413 Request Entity Too Large status.",
                            headers: {
                                "Tus-Resumable": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                            },
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                        },
                        415: {
                            // eslint-disable-next-line max-len
                            description: "Added by the Creation With Upload Extension. Content-Type was not application/offset+octet-stream",
                            headers: {
                                "Tus-Resumable": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                            },
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                        },
                        460: {
                            // eslint-disable-next-line max-len
                            description: "Added by the Creation With Upload Extension in combination with the checksum extension. Checksums mismatch",
                            headers: {
                                "Tus-Resumable": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                            },
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                        },
                    },
                },
                options: {
                    tags,
                    operationId: `${pathHash}TusOptions`,
                    summary: "Request to gather information about the Server's current configuration",
                    responses: {
                        204: {
                            description: "Success",
                            headers: {
                                "Tus-Resumable": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                                "Tus-Checksum-Algorithm": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Checksum-Algorithm",
                                    },
                                },
                                "Tus-Version": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Version",
                                    },
                                },
                                "Tus-Max-Size": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Max-Size",
                                    },
                                },
                                "Tus-Extension": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Extension",
                                    },
                                },
                            },
                        },
                    },
                },
                get: sharedGetList(`${pathHash}TusGetList`, tags),
            },
            [`${path.trimEnd()}/{id}`]: {
                delete: {
                    tags,
                    summary: "Added by the Termination extension.",
                    description:
                        // eslint-disable-next-line max-len
                        "When receiving a DELETE request for an existing upload the Server SHOULD free associated resources and MUST respond with the 204 No Content status confirming that the upload was terminated. For all future requests to this URL, the Server SHOULD respond with the 404 Not Found or 410 Gone status.",
                    operationId: `${pathHash}TusFilesDelete`,
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: {
                                type: "string",
                            },
                        },
                        {
                            name: "Tus-Resumable",
                            in: "header",
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
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                        },
                    },
                },
                head: {
                    tags,
                    summary: "Used to determine the offset at which the upload should be continued.",
                    description: "Used to determine the offset at which the upload should be continued.",
                    operationId: `${pathHash}TusFilesHead`,
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: {
                                type: "string",
                            },
                        },
                        {
                            name: "Tus-Resumable",
                            in: "header",
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
                                "Tus-Resumable": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                                "Cache-Control": {
                                    schema: {
                                        type: "string",
                                        enum: ["no-store"],
                                    },
                                },
                                "Upload-Offset": {
                                    schema: {
                                        $ref: "#/components/schemas/Upload-Offset",
                                    },
                                },
                                "Upload-Length": {
                                    schema: {
                                        $ref: "#/components/schemas/Upload-Length",
                                    },
                                },
                            },
                        },
                        403: {
                            description:
                                // eslint-disable-next-line max-len,radar/no-duplicate-string
                                "If the resource is not found, the Server SHOULD return either the 404 Not Found, 410 Gone or 403 Forbidden status without the Upload-Offset header.",
                            headers: {
                                "Tus-Resumable": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                            },
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                        },
                        404: {
                            $ref: "#/components/responses/404",
                        },
                        410: {
                            description:
                                // eslint-disable-next-line max-len
                                "If the resource is not found, the Server SHOULD return either the 404 Not Found, 410 Gone or 403 Forbidden status without the Upload-Offset header.",
                            headers: {
                                "Tus-Resumable": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                            },
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                        },
                        412: {
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
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                        },
                    },
                },
                patch: {
                    tags,
                    summary: "Used to resume the upload",
                    description:
                        // eslint-disable-next-line max-len
                        "The Server SHOULD accept PATCH requests against any upload URL and apply the bytes contained in the message at the given offset specified by the Upload-Offset header. All PATCH requests MUST use Content-Type: application/offset+octet-stream, otherwise the server SHOULD return a 415 Unsupported Media Type status.",
                    operationId: `${pathHash}TusFilePatch`,
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: {
                                type: "string",
                            },
                        },
                        {
                            name: "Tus-Resumable",
                            in: "header",
                            required: true,
                            schema: {
                                $ref: "#/components/schemas/Tus-Resumable",
                            },
                        },
                        {
                            name: "Content-Length",
                            in: "header",
                            description: "Length of the body of this request",
                            required: true,
                            schema: {
                                type: "integer",
                            },
                        },
                        {
                            name: "Upload-Offset",
                            in: "header",
                            required: true,
                            schema: {
                                $ref: "#/components/schemas/Upload-Offset",
                            },
                        },
                        {
                            name: "Upload-Checksum",
                            in: "header",
                            schema: {
                                $ref: "#/components/schemas/Upload-Checksum",
                            },
                        },
                    ],
                    requestBody: {
                        description: "Remaining (possibly partial) content of the file. Required if Content-Length > 0.",
                        required: false,
                        content: {
                            "application/offset+octet-stream": {
                                schema: {
                                    type: "string",
                                },
                            },
                        },
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
                                "Upload-Offset": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                                "Upload-Expires": {
                                    description:
                                        // eslint-disable-next-line max-len
                                        "Added by the expiration extension. The Upload-Expires response header indicates the time after which the unfinished upload expires. A Server MAY wish to remove incomplete upload after a given period of time to prevent abandoned upload from taking up extra storage. The Client SHOULD use this header to determine if an upload is still valid before attempting to resume the upload. This header MUST be included in every PATCH response if the upload is going to expire. If the expiration is known at the creation, the Upload-Expires header MUST be included in the response to the initial POST request. Its value MAY change over time. If a Client does attempt to resume an upload which has since been removed by the Server, the Server SHOULD respond with the 404 Not Found or 410 Gone status. The latter one SHOULD be used if the Server is keeping track of expired upload. In both cases the Client SHOULD start a new upload. The value of the Upload-Expires header MUST be in RFC 7231 datetime format.",
                                    schema: {
                                        type: "string",
                                    },
                                },
                            },
                        },
                        400: {
                            description: "Added by the checksum extension. The checksum algorithm is not supported by the server",
                            headers: {
                                "Tus-Resumable": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                            },
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                        },
                        403: {
                            description:
                                // eslint-disable-next-line max-len
                                "In the concatenation extension, the Server MUST respond with the 403 Forbidden status to PATCH requests against a final upload URL and MUST NOT modify the final or its partial upload.",
                            headers: {
                                "Tus-Resumable": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                            },
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                        },
                        404: {
                            description: "PATCH request against a non-existent resource",
                            headers: {
                                "Tus-Resumable": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                            },
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                        },
                        409: {
                            description:
                                // eslint-disable-next-line max-len
                                "PATCH request with Upload-Offset unequal to the offset of the resource on the server. The Upload-Offset header's value MUST be equal to the current offset of the resource.",
                            headers: {
                                "Tus-Resumable": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                            },
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                        },
                        410: {
                            description: "PATCH request against a non-existent resource",
                            headers: {
                                "Tus-Resumable": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                            },
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                        },
                        412: {
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
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                        },
                        415: {
                            description: "Content-Type was not application/offset+octet-stream",
                            headers: {
                                "Tus-Resumable": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                            },
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                        },
                        460: {
                            description: "Added by the checksum extension. Checksums mismatch",
                            headers: {
                                "Tus-Resumable": {
                                    schema: {
                                        $ref: "#/components/schemas/Tus-Resumable",
                                    },
                                },
                            },
                            content: {
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/Error",
                                    },
                                },
                            },
                        },
                    },
                },
                get: {
                    ...getSchemaObject,
                    parameters: [
                        ...(getSchemaObject.parameters as (OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject)[]),
                        {
                            name: "Tus-Resumable",
                            in: "header",
                            description: "Version of the protocol supported by the client",
                            required: true,
                            schema: {
                                $ref: "#/components/schemas/Tus-Resumable",
                            },
                        },
                    ],
                },
            },
        },
        components: {
            schemas: {
                "Tus-Resumable": {
                    type: "string",
                    enum: ["1.0.0"],
                    description: "Protocol version",
                },
                "Tus-Version": {
                    description:
                        // eslint-disable-next-line max-len
                        "The Tus-Version response header MUST be a comma-separated list of protocol versions supported by the Server. The list MUST be sorted by Server's preference where the first one is the most preferred one.",
                    type: "string",
                },
                "Tus-Extension": {
                    description:
                        // eslint-disable-next-line max-len
                        "The Tus-Extension response header MUST be a comma-separated list of the extensions supported by the Server. If no extensions are supported, the Tus-Extension header MUST be omitted.",
                    type: "string",
                },
                "Tus-Max-Size": {
                    description:
                        // eslint-disable-next-line max-len
                        "The Tus-Max-Size response header MUST be a non-negative integer indicating the maximum allowed size of an entire upload in bytes. The Server SHOULD set this header if there is a known hard limit.",
                    type: "integer",
                },
                "Upload-Length": {
                    description:
                        // eslint-disable-next-line max-len
                        "The Upload-Length request and response header indicates the size of the entire upload in bytes. The value MUST be a non-negative integer. In the concatenation extension, the Client MUST NOT include the Upload-Length header in the final upload creation",
                    type: "integer",
                },
                "Upload-Offset": {
                    description:
                        // eslint-disable-next-line max-len
                        "The Upload-Offset request and response header indicates a byte offset within a resource. The value MUST be a non-negative integer.",
                    type: "integer",
                },
                "Tus-Checksum-Algorithm": {
                    description:
                        // eslint-disable-next-line max-len
                        "Added by the checksum extension. The Tus-Checksum-Algorithm response header MUST be a comma-separated list of the checksum algorithms supported by the server.",
                    type: "string",
                },
                "Upload-Checksum": {
                    description:
                        // eslint-disable-next-line max-len
                        "Added by the checksum extension. The Upload-Checksum request header contains information about the checksum of the current body payload. The header MUST consist of the name of the used checksum algorithm and the Base64 encoded checksum separated by a space.",
                    type: "string",
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
            responses: {
                404: {
                    description: "Not Found",
                    content: {
                        "application/json": {
                            schema: {
                                $ref: "#/components/schemas/Error",
                            },
                        },
                    },
                },
            },
            examples: sharedFileMetaExampleObject,
        },
    };
};

export default swaggerSpec;
