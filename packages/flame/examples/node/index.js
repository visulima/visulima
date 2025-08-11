import { createServer } from "node:http";

import httpDisplayer from "../../dist/displayer/http-displayer.mjs";

// Deeper stack builders (sync + async levels)
function parseEnvironmentConfig() {
    // Deepest sync failure
    throw new Error("Invalid environment configuration: missing 'APP_SECRET'");
}

function initializeModelLayer() {
    try {
        parseEnvironmentConfig();
    } catch (innerError) {
        throw new Error("Model initialization failed", { cause: innerError });
    }
}

async function queryDatabase() {
    // Simulate async boundary
    await Promise.resolve();
    throw new Error("Database connection timeout");
}

/**
 * @param {string} userId
 * @returns {Promise<Record<string, unknown>>}
 */
async function loadUserProfile(userId) {
    try {
        await queryDatabase();
    } catch (innerError) {
        throw new Error(`Failed to load user profile for ${userId}`, { cause: innerError });
    }

    return { id: userId, name: "Test User", preferences: {} };
}

/**
 * @param {Record<string, unknown>} profile
 */
function computeRecommendations(profile) {
    try {
        initializeModelLayer();
    } catch (innerError) {
        throw new Error("Recommendation engine startup failed", { cause: innerError });
    }

    // This line is not reached due to the error above, but keeps another frame
    return [profile];
}

async function renderController() {
    try {
        const profile = await loadUserProfile("user-123");
        computeRecommendations(profile);
    } catch (innerError) {
        throw new Error("Controller render failed", { cause: innerError });
    }
}

const port = 3000;
const server = createServer(async (request, response) => {
    try {
        await renderController();
    } catch (controllerError) {
        /** @type {Error & { hint?: string }} */
        const error = new Error("This is a error message, that is really long error message, This is a error message, that is really long error message", {
            cause: controllerError,
        });
        error.hint = "This is a hint message";

        try {
            const displayerHandler = await httpDisplayer(error, [
                // openAiFinder()
            ]);

            await displayerHandler(request, response);
            return;
        } catch (error_) {
            console.error("Error in flame's httpDisplayer or its handler:", error_);
        }
    }

    // Attempt to send a fallback response
    if (!response.headersSent) {
        response.writeHead(500, { "Content-Type": "text/plain" });
        response.end("Internal Server Error: Could not display error details.");
    } else if (!response.writableEnded) {
        response.end();
    }
});

server.listen(port, () => {
    console.log(`Running at http://localhost:${port}`);
});
