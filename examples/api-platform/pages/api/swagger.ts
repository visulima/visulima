import { swaggerApiRoute } from "@visulima/api-platform";

import packageJson from "../../package.json";

export default swaggerApiRoute(packageJson.name, packageJson.version, {
    options: {
        swaggerDefinition: {
            servers: [
                {
                    url: "/",
                    description: "",
                },
            ],
        },
    },
});
