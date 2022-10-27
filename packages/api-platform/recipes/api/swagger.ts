import { swaggerApiRoute } from "@visulima/api-platform/next";

import packageJson from "../../package.json";

export default swaggerApiRoute(packageJson.name, packageJson.version, {
    swaggerDefinition: {
        servers: [
            {
                url: "/",
                description: "",
            },
        ],
    },
});
