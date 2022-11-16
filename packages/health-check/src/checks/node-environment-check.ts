import type { Checker } from "../types";

const DISPLAY_NAME = "Node Environment Check";

/**
 * Register the `env` checker to ensure that `NODE_ENV` environment
 * variable is defined.
 */
const nodeEnvironmentCheck = (expectedEnv?: string): Checker => async () => {
    const environment = process.env.NODE_ENV;

    let errorMessage: string | undefined;

    if (typeof environment !== "undefined" && typeof expectedEnv !== "undefined" && environment !== expectedEnv) {
        errorMessage = `NODE_ENV environment variable is set to "${environment}" instead of "${expectedEnv}".`;
    } else if (typeof environment === "undefined") {
        errorMessage = ["Missing NODE_ENV environment variable.", "It can make some parts of the application misbehave"].join(" ");
    }

    if (typeof errorMessage !== "undefined") {
        return {
            displayName: DISPLAY_NAME,
            health: {
                healthy: false,
                message: errorMessage,
                timestamp: new Date().toISOString(),
            },
        };
    }

    return {
        displayName: DISPLAY_NAME,
        health: {
            healthy: true,
            timestamp: new Date().toISOString(),
        },
        meta: {
            env: environment,
        },
    };
};

export default nodeEnvironmentCheck;
