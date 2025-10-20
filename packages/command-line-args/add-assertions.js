import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to count expect calls in a test block
/**
 *
 * @param testContent
 */
function countExpectCalls(testContent) {
    const expectMatches = testContent.match(/^\s*expect\(/gm);

    return expectMatches ? expectMatches.length : 0;
}

// Function to add expect.assertions to a file
/**
 *
 * @param filePath
 */
function addAssertionsToFile(filePath) {
    console.log(`Processing ${filePath}`);
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    let result = content;

    // Find all it() blocks and add expect.assertions
    const itBlockRegex = /^\s*it\("([^"]+)",\s*\(\)\s*=>\s*\{$/gm;
    let match;

    while ((match = itBlockRegex.exec(result)) !== null) {
        const openingBracePos = match.index + match[0].length - 1; // Position of the opening {
        const itBlock = extractItBlock(result, openingBracePos + 1); // Start after the {

        if (itBlock) {
            const expectCount = countExpectCalls(itBlock.content);

            if (expectCount > 0 && !itBlock.content.includes("expect.assertions(")) {
                // Insert expect.assertions after the opening brace
                const insertPoint = openingBracePos + 1;
                const before = result.slice(0, insertPoint);
                const after = result.slice(insertPoint);

                result = `${before}\n            expect.assertions(${expectCount});${after}`;

                // Adjust regex position since we modified the string
                itBlockRegex.lastIndex += `\n            expect.assertions(${expectCount});`.length;
            }
        }
    }

    fs.writeFileSync(filePath, result);
}

// Function to extract the content of an it() block
/**
 *
 * @param content
 * @param startPos
 */
function extractItBlock(content, startPos) {
    let braceCount = 1; // We start after the opening brace
    let pos = startPos;

    while (pos < content.length && braceCount > 0) {
        if (content[pos] === "{") {
            braceCount++;
        } else if (content[pos] === "}") {
            braceCount--;
        }

        pos++;
    }

    if (
        braceCount === 0 // We found the matching closing brace, now check if it's followed by );
        && content.slice(pos, pos + 2) === ");"
    ) {
        return {
            content: content.slice(startPos, pos - 1), // Don't include the closing }
            end: pos - 1,
            start: startPos,
        };
    }

    return null;
}

// Process all test files
const testDir = path.join(__dirname, "__tests__");
const files = fs.readdirSync(testDir).filter((f) => f.endsWith(".test.ts") || f.endsWith(".test.cts"));

files.forEach((file) => {
    const filePath = path.join(testDir, file);

    addAssertionsToFile(filePath);
});

// Process internals directory
const internalsDir = path.join(testDir, "internals");

if (fs.existsSync(internalsDir)) {
    const internalsFiles = fs.readdirSync(internalsDir).filter((f) => f.endsWith(".test.ts"));

    internalsFiles.forEach((file) => {
        const filePath = path.join(internalsDir, file);

        addAssertionsToFile(filePath);
    });
}

console.log("Done adding expect.assertions to all test files");
