import type { Checker } from "../types";

const DISPLAY_NAME = "Node Environment Check";

/**
 * Register the `env` checker to ensure that `NODE_ENV` environment
 * variable is defined.
 */
const nodeEnvironmentCheck: Checker = async () => {
    const environment = process.env.NODE_ENV;

    return environment
        ? {
            displayName: DISPLAY_NAME,
            health: {
                healthy: true,
                timestamp: new Date().toISOString(),
            },
            meta: {
                env: environment,
            }
        }
        : {
            displayName: DISPLAY_NAME,
            health: {
                healthy: false,
                message: ["Missing NODE_ENV environment variable.", "It can make some parts of the application misbehave"].join(" "),
                timestamp: new Date().toISOString(),
            },
        };
};

export default nodeEnvironmentCheck;
