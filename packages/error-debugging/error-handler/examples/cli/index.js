// @ts-ignore - local workspace package is available at runtime
import colorize from "@visulima/colorize";
import { cliHandler } from "@visulima/error-handler/dist/handler/cli-handler.js";

/**
 *
 */
async function demoHint() {
    try {
        /**
         *
         */
        function deep() {
            throw new Error("Low-level I/O failure: missing configuration file");
        }

        /**
         *
         */
        function intermediate() {
            try {
                deep();
            } catch (error) {
                throw new Error("Intermediate module error", { cause: error });
            }
        }

        intermediate();
    } catch (innerError) {
        /** @type {Error & { hint?: string }} */
        const error = new Error("CLI demo: rendered error with hint", { cause: innerError });

        error.hint = "Ensure the config file exists and is readable. Check permissions and path.";

        await cliHandler(error, {
            color: {
                // Optional: tweak codeframe colors (example overrides title only)
                // codeFrame coloring can be provided if desired
                // Boxen coloring using visulima/colorize
                boxen: {
                    borderColor: (/** @type {string} */ s) => colorize.green(s),
                    headerTextColor: (/** @type {string} */ s) => colorize.bold(colorize.green(s)),
                    textColor: (/** @type {string} */ s) => s,
                },
            },
        });
    }
}

/**
 *
 */
async function demoRule() {
    try {
        // Trigger a TypeError to exercise the built-in rule-based hints
        const object = /** @type {any} */ undefined;

        console.log(object.foo);
    } catch (error) {
        await cliHandler(/** @type {Error} */ error, {
            color: {
                boxen: {
                    borderColor: (/** @type {string} */ s) => colorize.cyan(s),
                    headerTextColor: (/** @type {string} */ s) => colorize.bold(colorize.cyan(s)),
                    textColor: (/** @type {string} */ s) => s,
                },
            },
        });
    }
}

await demoHint();
console.log("\n---\n");
await demoRule();
