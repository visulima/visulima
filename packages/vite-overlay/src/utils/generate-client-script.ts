import type { BalloonConfig } from "../types";

import { MESSAGE_TYPE } from "../constants";

/**
 * Generates the client-side script for error interception and reporting.
 * @param mode The current Vite mode (development/production)
 * @param forwardedConsoleMethods Array of console method names to forward
 * @param balloonConfig Balloon configuration options (optional)
 * @returns The client-side JavaScript code as a string
 */
const generateClientScript = (mode: string, forwardedConsoleMethods: string[], balloonConfig?: BalloonConfig): string => {
    const consoleInterceptors = forwardedConsoleMethods
        .map((method) => {
            const capitalizedMethod = method.charAt(0).toUpperCase() + method.slice(1);

            return `
var orig${capitalizedMethod} = console.${method};

console.${method} = function(...args) {
    function parseConsoleArgs(args) {
        if (
            args.length > 3 &&
            typeof args[0] === 'string' &&
            args[0].startsWith('%c%s%c') &&
            typeof args[1] === 'string' &&
            typeof args[2] === 'string' &&
            typeof args[3] === 'string'
        ) {
            const environmentName = args[2]
            const maybeError = args[4]

            return {
                environmentName: environmentName.trim(),
                error: isError(maybeError) ? maybeError : null,
            }
        }

        return {
            environmentName: null,
            error: null,
        }
    }

    function isError(err) {
        return typeof err === 'object' && err !== null && 'name' in err && 'message' in err;
    }

    try {
        var maybeError;

        if (${JSON.stringify(mode)} !== 'production') {
            const { error: replayedError } = parseConsoleArgs(args)

            if (replayedError) {
                maybeError = replayedError
            } else if (args.length > 0 && isError(args[0])) {
                maybeError = args[0]
            } else if (args.length > 1 && isError(args[1])) {
                maybeError = args[1]
            }
        } else {
            maybeError = args.length > 0 && isError(args[0]) ? args[0] : null
        }

        if (maybeError) {
            sendError(maybeError);
        }
    } catch {}

    return orig${capitalizedMethod}.apply(console, args);
};`;
        })
        .join("\n");

    return String.raw`
import { createHotContext } from '/@vite/client';

const hot = createHotContext('/@visulima/vite-overlay');

async function sendError(error, loc) {
    if (!(error instanceof Error)) {
        error = new Error("(unknown runtime error)");
    }

    function extractCauseChain(err) {
        if (!err || !err.cause) {
            return null;
        }

        var current = err.cause;
        var rootCause = {
            name: current.name || null,
            message: current.message || null,
            stack: current.stack || null,
            cause: null
        };

        var currentNested = rootCause;
        current = current.cause;

        while (current) {
            currentNested.cause = {
                name: current.name || null,
                message: current.message || null,
                stack: current.stack || null,
                cause: null
            };
            currentNested = currentNested.cause;
            current = current.cause;
        }

        return rootCause;
    }

    var causeChain = extractCauseChain(error);

    hot.send('${MESSAGE_TYPE}', {
        name: error?.name || null,
        message: error.message,
        stack: error.stack,
        cause: causeChain,
        ownerStack: error?.ownerStack || null,
        file: loc?.filename || null,
        line: loc?.lineno || null,
        column: loc?.colno || null
    });
}

let stackTraceRegistered = false;

const MAX_STACK_LENGTH = 50;

/**
 * Registers the stack trace limit for better error capturing.
 * @param {number} limit - The stack trace limit to register.
 */
// eslint-disable-next-line func-style
function registerStackTraceLimit(limit = MAX_STACK_LENGTH) {
    if (stackTraceRegistered) {
        return;
    }

    try {
        Error.stackTraceLimit = limit;
        stackTraceRegistered = true;
    } catch {
        // Not all browsers support this so we don't care if it errors
    }
}

registerStackTraceLimit();

window.addEventListener("error", function (evt) {
    sendError(evt.error, { filename: evt.filename, lineno: evt.lineno, colno: evt.colno });
});

window.addEventListener("unhandledrejection", function (evt) {
    sendError(evt.reason);
});

// Expose overlay API for manual control
window.__visulima_overlay__ = {
    open: function() {
        const overlay = globalThis.__v_o__current;
        if (overlay && overlay.__elements?.root) {
            overlay.__elements.root.classList.remove("hidden");
            if (typeof overlay._saveBalloonState === "function") {
                overlay._saveBalloonState("overlay", "open");
            }
        }
    },
    close: function() {
        const overlay = globalThis.__v_o__current;
        if (overlay && typeof overlay.close === "function") {
            overlay.close();
        }
    },
    // Get the current overlay instance if available
    getInstance: function() {
        return globalThis.__v_o__current || null;
    },
    // Send/report an error to the overlay
    sendError: sendError
};

// Backward compatibility: keep __flameSendError for existing code
window.__flameSendError = sendError;

${consoleInterceptors}
`;
};

export default generateClientScript;
