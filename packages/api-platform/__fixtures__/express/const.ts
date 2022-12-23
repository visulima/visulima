import type { ExpressRegex } from "../../src/framework/cli/command/list/routes/express/types";

export const staticPath = /^\/sub-route2\/?(?=\/|$)/i as ExpressRegex;

export const oneDynamicPath = () => {
    return {
        regex: /^\/sub-route\/(?:([^\/]+?))\/?(?=\/|$)/i as ExpressRegex,
        keys: [
            {
                name: "test1",
                optional: false,
                offset: 12,
            },
        ],
    };
};

export const twoDynamicPaths = () => {
    return {
        regex: /^\/sub-sub-route\/(?:([^\/]+?))\/(?:([^\/]+?))\/?(?=\/|$)/i as ExpressRegex,
        keys: [
            {
                name: "test2",
                optional: false,
                offset: 16,
            },
            {
                name: "test3",
                optional: false,
                offset: 31,
            },
        ],
    };
};

export const operationObject = {
    description: "Returns pets based on ID",
    summary: "Find pets by ID",
    operationId: "getPetsById",
    responses: {
        "200": {
            description: "pet response",
            content: {
                "*/*": {
                    schema: {
                        type: "array",
                        items: {
                            $ref: "#/components/schemas/Pet",
                        },
                    },
                },
            },
        },
        default: {
            description: "error payload",
            content: {
                "text/html": {
                    schema: {
                        $ref: "#/components/schemas/ErrorModel",
                    },
                },
            },
        },
    },
};
