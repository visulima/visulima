import Ono from "@visulima/ono";

const ono = new Ono();

// Create a test error
const error = new Error("Something went wrong!");
error.cause = new Error("Root cause of the problem");

// Example 1: Basic ANSI output
console.log("=== Basic ANSI Output ===");
/** @type {{ errorAnsi: string; solutionBox: string | undefined }} */
const result = await ono.toANSI(error);

console.log("Error:");
console.log(result.errorAnsi);

if (result.solutionBox) {
    console.log("\nSolution:");
    console.log(result.solutionBox);
}

// Example 2: ANSI with solution finders
console.log("\n=== ANSI with Custom Solution ===");
const customSolutionFinder = {
    name: "custom-finder",
    priority: 100,
    /** @param {Error} err */
    /** @param {any} context */
    handle: async (err, context) => {
        if (err.message.includes("wrong")) {
            return {
                header: "Custom Solution",
                body: "Try checking your configuration file for typos.",
            };
        }
        return undefined;
    },
};

/** @type {{ errorAnsi: string; solutionBox: string | undefined }} */
const resultWithCustom = await ono.toANSI(error, {
    solutionFinders: [customSolutionFinder],
});

console.log("Error with custom solution:");
console.log(resultWithCustom.errorAnsi);

if (resultWithCustom.solutionBox) {
    console.log("\nCustom Solution:");
    console.log(resultWithCustom.solutionBox);
}

// Example 3: HTML output (for demonstration)
console.log("\n=== HTML Output (would be rendered in browser) ===");
const html = await ono.toHTML(error, {
    cspNonce: "random-nonce",
    theme: "dark",
});

console.log("HTML length:", html.length, "characters");
console.log("Contains error title:", html.includes("Something went wrong"));
console.log("Contains CSP nonce:", html.includes("random-nonce"));
