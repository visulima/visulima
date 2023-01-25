import type { Checker } from "../types";

const DISPLAY_NAME = "Node Environment Check";

/**
 * Register the `env` checker to ensure that `NODE_ENV` environment
 * variable is defined.
 */
const nodeEnvironmentCheck = (expectedEnvironment?: string): Checker => async () => {
    // eslint-disable-next-line @typescript-eslint/dot-notation
    const environment: string | undefined = process.env["NODE_ENV"];

    let errorMessage: string | undefined;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (environment !== undefined && expectedEnvironment !== undefined && environment !== expectedEnvironment) {
        errorMessage = `NODE_ENV environment variable is set to "${environment}" instead of "${expectedEnvironment}".`;
    } else if (!environment) {
        errorMessage = ["Missing NODE_ENV environment variable.", "It can make some parts of the application misbehave"].join(" ");
    }

    if (errorMessage !== undefined) {
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
