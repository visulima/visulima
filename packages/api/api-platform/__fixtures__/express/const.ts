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
