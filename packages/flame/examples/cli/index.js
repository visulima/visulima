import { cliHandler } from "../../dist/handler/cli-handler.mjs";

async function demoHint() {
    try {
        function deep() {
            throw new Error("Low-level I/O failure: missing configuration file");
        }

        function intermediate() {
            try {
                deep();
            } catch (inner) {
                throw new Error("Intermediate module error", { cause: inner });
            }
        }

        intermediate();
    } catch (innerError) {
        /** @type {Error & { hint?: string }} */
        const error = new Error("CLI demo: rendered error with hint", { cause: innerError });
        error.hint = "Ensure the config file exists and is readable. Check permissions and path.";

        await cliHandler(error, [], console);
    }
}

async function demoRule() {
    try {
        // Trigger a TypeError to exercise the built-in rule-based hints
        const obj = /** @type {any} */ (undefined);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        console.log(obj.foo);
    } catch (error) {
        await cliHandler(/** @type {Error} */ (error), [], console);
    }
}

await demoHint();
console.log("\n---\n");
await demoRule();
