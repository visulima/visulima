import { swaggerApiRoute } from "@visulima/api-platform/next";

export default swaggerApiRoute({
    swaggerDefinition: {
        servers: [
            {
                url: "/",
                description: "",
            },
        ],
    },
});
