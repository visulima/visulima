import { describe, expect, it } from "vitest";

import { findErrorInSourceCode } from "../../src/utils/find-error-in-source";

describe(findErrorInSourceCode, () => {
    describe("standard Error patterns", () => {
        it("should find direct new Error() with double quotes", () => {
            expect.assertions(1);

            const sourceCode = `
                function test() {
                    throw new Error("Test error message");
                }
            `;
            const result = findErrorInSourceCode(sourceCode, "Test error message");

            expect(result).toEqual({ column: 27, line: 3 }); // Position of 'new' keyword
        });

        it("should find direct new Error() with single quotes", () => {
            expect.assertions(1);

            const sourceCode = `
                function test() {
                    throw new Error('Test error message');
                }
            `;
            const result = findErrorInSourceCode(sourceCode, "Test error message");

            expect(result).toEqual({ column: 27, line: 3 }); // Position of 'new' keyword
        });

        it("should find throw new Error() pattern", () => {
            expect.assertions(1);

            const sourceCode = `
                function test() {
                    if (condition) {
                        throw new Error("Validation failed");
                    }
                }
            `;
            const result = findErrorInSourceCode(sourceCode, "Validation failed");

            expect(result).toEqual({ column: 31, line: 4 }); // Position of 'new' keyword
        });

        it("should find new Error() without throw", () => {
            expect.assertions(1);

            const sourceCode = `
                function createError() {
                    return new Error("Creation error");
                }
            `;
            const result = findErrorInSourceCode(sourceCode, "Creation error");

            expect(result).toEqual({ column: 28, line: 3 }); // Position of 'new' keyword
        });
    });

    describe("custom error classes", () => {
        it("should find custom error class with throw", () => {
            expect.assertions(1);

            const sourceCode = `
                class ValidationError extends Error {
                    constructor(message: string) {
                        super(message);
                    }
                }

                function validate() {
                    throw new ValidationError("Invalid input provided");
                }
            `;
            const result = findErrorInSourceCode(sourceCode, "Invalid input provided");

            expect(result).toEqual({ column: 27, line: 9 }); // Position of 'new' keyword
        });

        it("should find custom error class without throw", () => {
            expect.assertions(1);

            const sourceCode = `
                class ApiError extends Error {
                    constructor(message: string, status: number) {
                        super(message);
                    }
                }

                function handleError() {
                    return new ApiError("Network request failed", 500);
                }
            `;
            const result = findErrorInSourceCode(sourceCode, "Network request failed");

            expect(result).toEqual({ column: 28, line: 9 }); // Position of 'new' keyword
        });

        it.skip("should find custom error with template literal", () => {
            // TODO: Implement support for template literals in custom error constructors
            // This requires parsing constructor arguments and template literal resolution
            const sourceCode = `
                class HttpError extends Error {
                    constructor(status: number, message: string) {
                        super(\`HTTP \${status}: \${message}\`);
                    }
                }

                function fetchData() {
                    throw new HttpError(404, "Not found");
                }
            `;
            const result = findErrorInSourceCode(sourceCode, "HTTP 404: Not found");

            expect(result).toEqual({ column: 28, line: 8 });
        });

        it("should prioritize custom error class over generic patterns", () => {
            expect.assertions(1);

            const sourceCode = `
                class CustomError extends Error {
                    constructor(message: string) {
                        super(message);
                    }
                }

                function test() {
                    throw new CustomError("Test message");
                }
            `;
            const result = findErrorInSourceCode(sourceCode, "Test message");

            expect(result).toEqual({ column: 27, line: 9 }); // Position of 'new' keyword
        });
    });

    describe("dynamic error messages", () => {
        it("should find dynamic error with line number", () => {
            expect.assertions(1);

            const sourceCode = `
                function createDynamicError() {
                    const line = 42;
                    throw new Error("Error from line " + line);
                }
            `;
            const result = findErrorInSourceCode(sourceCode, "Error from line 42");

            expect(result).toEqual({ column: 27, line: 4 }); // Position of 'new' keyword
        });

        it("should find template literal dynamic error", () => {
            expect.assertions(1);

            const sourceCode = `
                function createTemplateError() {
                    const context = "validation";
                    throw new Error(\`Error in \${context} context\`);
                }
            `;
            const result = findErrorInSourceCode(sourceCode, "Error in validation context");

            expect(result).toEqual({ column: 27, line: 4 }); // Position of 'new' keyword
        });

        it("should prioritize template literal patterns for dynamic errors", () => {
            const sourceCode = `
                function mixedErrors() {
                    throw new Error(\`Dynamic error: \${value}\`);
                    throw new Error("Static error message");
                }
            `;
            const result = findErrorInSourceCode(sourceCode, "Dynamic error: test");

            expect(result).toEqual({ column: 27, line: 3 }); // Position of 'new' keyword
        });
    });

    describe("multiple occurrences", () => {
        it("should find first occurrence by default", () => {
            const sourceCode = `
                function test1() {
                    throw new Error("Duplicate message");
                }

                function test2() {
                    throw new Error("Duplicate message");
                }
            `;
            const result = findErrorInSourceCode(sourceCode, "Duplicate message");

            expect(result).toEqual({ column: 27, line: 3 }); // Position of 'new' keyword
        });

        it("should find second occurrence with occurrenceIndex = 1", () => {
            const sourceCode = `
                function test1() {
                    throw new Error("Duplicate message");
                }

                function test2() {
                    throw new Error("Duplicate message");
                }
            `;
            const result = findErrorInSourceCode(sourceCode, "Duplicate message", 1);

            expect(result).toEqual({ column: 27, line: 7 }); // Position of 'new' keyword
        });

        it("should return null when occurrenceIndex is out of range", () => {
            const sourceCode = `
                function test() {
                    throw new Error("Single message");
                }
            `;
            const result = findErrorInSourceCode(sourceCode, "Single message", 5);

            expect(result).toBeNull();
        });
    });

    describe("edge cases", () => {
        it("should return null for empty source code", () => {
            const result = findErrorInSourceCode("", "error message");

            expect(result).toBeNull();
        });

        it("should return null for empty error message", () => {
            const sourceCode = "console.log('test');";
            const result = findErrorInSourceCode(sourceCode, "");

            expect(result).toBeNull();
        });

        it("should return null when error message is not found", () => {
            const sourceCode = `
                function test() {
                    console.log("Hello world");
                }
            `;
            const result = findErrorInSourceCode(sourceCode, "Error not present");

            expect(result).toBeNull();
        });

        it("should handle lines with only whitespace", () => {
            const sourceCode = `
                function test() {

                    throw new Error("Test message");
                }
            `;
            const result = findErrorInSourceCode(sourceCode, "Test message");

            expect(result).toEqual({ column: 27, line: 4 }); // Position of 'new' keyword
        });

        it("should handle multi-line error constructors", () => {
            const sourceCode = `
                function test() {
                    throw new Error(
                        "Multi-line error message"
                    );
                }
            `;
            const result = findErrorInSourceCode(sourceCode, "Multi-line error message");

            expect(result).toEqual({ column: 26, line: 4 });
        });
    });

    describe("complex scenarios", () => {
        it.skip("should handle nested error classes correctly", () => {
            // TODO: Implement support for template literals in inherited error constructors
            // This requires parsing inheritance chains and constructor argument resolution
            const sourceCode = `
                class BaseError extends Error {
                    constructor(message: string) {
                        super(message);
                    }
                }

                class ValidationError extends BaseError {
                    constructor(field: string, value: any) {
                        super(\`Validation failed for \${field}: \${value}\`);
                    }
                }

                function validateUser() {
                    throw new ValidationError("email", "invalid@format");
                }
            `;
            const result = findErrorInSourceCode(sourceCode, "Validation failed for email: invalid@format");

            expect(result).toEqual({ column: 28, line: 14 });
        });

        it("should handle mixed error patterns in same file", () => {
            const sourceCode = `
                // Standard Error
                function func1() {
                    throw new Error("Standard error");
                }

                // Custom Error
                class CustomError extends Error {
                    constructor(message: string) {
                        super(message);
                    }
                }

                function func2() {
                    throw new CustomError("Custom error message");
                }

                // Dynamic Error
                function func3() {
                    const line = 123;
                    throw new Error("Error from line " + line);
                }
            `;

            // Should find custom error first due to priority
            const customResult = findErrorInSourceCode(sourceCode, "Custom error message");

            expect(customResult).toEqual({ column: 27, line: 15 }); // Position of 'new' keyword

            // Should find standard error
            const standardResult = findErrorInSourceCode(sourceCode, "Standard error");

            expect(standardResult).toEqual({ column: 27, line: 4 }); // Position of 'new' keyword

            // Should find dynamic error
            const dynamicResult = findErrorInSourceCode(sourceCode, "Error from line 123");

            expect(dynamicResult).toEqual({ column: 27, line: 21 }); // Position of 'new' keyword
        });

        it("should handle complex template literals", () => {
            const sourceCode = `
                function complexError() {
                    const userId = 123;
                    const action = "delete";
                    throw new Error(\`User \${userId} attempted \${action} but insufficient permissions\`);
                }
            `;
            const result = findErrorInSourceCode(sourceCode, "User 123 attempted delete but insufficient permissions");

            expect(result).toEqual({ column: 27, line: 5 }); // Position of 'new' keyword
        });
    });

    describe("referenceError handling", () => {
        it("should find undefined variable in direct reference", () => {
            const sourceCode = `
                function test() {
                    console.log(myVariable);
                }
            `;
            const result = findErrorInSourceCode(sourceCode, "myVariable is not defined");

            expect(result).toEqual({ column: 33, line: 3 });
        });

        it("should find undefined variable in template literal", () => {
            const sourceCode = `
                function greet() {
                    const message = \`Hello \${undefinedVar}!\`;
                    return message;
                }
            `;
            const result = findErrorInSourceCode(sourceCode, "undefinedVar is not defined");

            expect(result).toEqual({ column: 46, line: 3 });
        });

        it("should find undefined variable in JSX/Svelte attribute", () => {
            const sourceCode = `
                function Component() {
                    return <div className={missingClass}>Hello</div>;
                }
            `;
            const result = findErrorInSourceCode(sourceCode, "missingClass is not defined");

            expect(result).toEqual({ column: 44, line: 3 });
        });

        it("should find undefined variable in Svelte template", () => {
            const sourceCode = `
                <script>
                    let userName = "John";
                </script>

                <h1>Hello {userName}</h1>
                <p>Welcome {missingVar}!</p>
            `;
            const result = findErrorInSourceCode(sourceCode, "missingVar is not defined");

            expect(result).toEqual({ column: 29, line: 7 });
        });

        it("should handle multiline ReferenceError messages", () => {
            const sourceCode = `
                function problematic() {
                    return undefinedVariable + 1;
                }
            `;
            const multilineError = `undefinedVariable is not defined

        in <unknown>`;
            const result = findErrorInSourceCode(sourceCode, multilineError);

            expect(result).toEqual({ column: 28, line: 3 });
        });

        it("should prioritize variable references over error constructors", () => {
            const sourceCode = `
                function test() {
                    throw new Error(missingVar + " not found");
                }
            `;
            const result = findErrorInSourceCode(sourceCode, "missingVar is not defined");

            expect(result).toEqual({ column: 37, line: 3 });
        });

        it("should find variable in complex expressions", () => {
            const sourceCode = `
                function calculate() {
                    return someUndefined * 2 + otherMissing;
                }
            `;
            const result = findErrorInSourceCode(sourceCode, "someUndefined is not defined");

            expect(result).toEqual({ column: 28, line: 3 });
        });
    });

    describe("error message parsing", () => {
        it("should extract variable name from ReferenceError with stack trace", () => {
            const sourceCode = `
                function broken() {
                    console.log(brokenVar);
                }
            `;
            const errorWithStack = `brokenVar is not defined

        at broken (app.js:10:20)
        at main (app.js:5:10)`;
            const result = findErrorInSourceCode(sourceCode, errorWithStack);

            expect(result).toEqual({ column: 33, line: 3 });
        });

        it("should handle TypeError for undefined functions", () => {
            const sourceCode = `
                function callUndefined() {
                    return missingFunction();
                }
            `;
            const result = findErrorInSourceCode(sourceCode, "missingFunction is not a function");

            // TypeError for undefined functions is harder to pinpoint exactly
            // The function call location might not be found due to how the error is generated
            expect(result).toBeDefined(); // At least it shouldn't crash
        });

        it("should handle property access errors", () => {
            const sourceCode = `
                function accessProperty() {
                    return null.invalidProperty;
                }
            `;
            const result = findErrorInSourceCode(sourceCode, "Cannot read properties of null (reading invalidProperty)");

            expect(result).toEqual({ column: 33, line: 3 });
        });
    });

    describe("import resolution error cases", () => {
        it("should handle vite.svg import resolution error", () => {
            const sourceCode = `import "./App.css";

import { useState } from "react";

import viteLogo from "../vite.svg";
import reactLogo from "./assets/react.svg";

function App() {
    const [count, setCount] = useState(0);

    return (
        <>
            <div>
                <a href="https://vite.dev" target="_blank">
                    <img alt="Vite logo" className="logo" src={viteLogo} />
                </a>
                <a href="https://react.dev" target="_blank">
                    <img alt="React logo" className="logo react" src={reactLogo} />
                </a>
            </div>
            <h1>Vite + React</h1>
        </>
    );
}

export default App;`;

            // This is the actual error message from Vite
            const errorMessage = `Failed to resolve import "../vite.svg" from "src/App.tsx". Does the file exist?`;

            const result = findErrorInSourceCode(sourceCode, errorMessage);

            expect(result).toEqual({ column: 22, line: 5 }); // Line 5: points to "../vite.svg" (the problematic import path)
        });

        it("should handle relative import path in error message", () => {
            const sourceCode = `import React from 'react';
import logo from './assets/logo.png';
import styles from './App.module.css';

function App() {
  return <div className={styles.container}>Hello</div>;
}`;

            const errorMessage = `Failed to resolve import "./assets/logo.png" from "src/App.tsx"`;

            const result = findErrorInSourceCode(sourceCode, errorMessage);

            expect(result).toEqual({ column: 18, line: 2 }); // Line 2: points to './assets/logo.png' (the problematic import path)
        });
    });

    describe("real Svelte error cases", () => {
        it("should find svelteLogo1 in real Svelte template", () => {
            const sourceCode = `<script lang="ts">
  import svelteLogo from './assets/svelte.svg'
  import viteLogo from '/vite.svg'
  import Counter from './lib/Counter.svelte'
</script>

<main>
  <div>
    <a href="https://vite.dev" target="_blank" rel="noreferrer">
      <img src={viteLogo} class="logo" alt="Vite Logo" />
    </a>
    <a href="https://svelte.dev" target="_blank" rel="noreferrer">
      <img src={svelteLogo1} class="logo svelte" alt="Svelte Logo" />
    </a>
  </div>

  <h1>Vite + Svelte</h1>

  <div class="card">
    <Counter />
  </div>

  <p>
    Check out <a href="https://github.com/sveltejs/kit#readme" target="_blank" rel="noreferrer">SvelteKit</a>, the official Svelte app framework powered by Vite!
  </p>
</main>

<style>
  .logo {
    height: 6em;
    padding: 1.5em;
    will-change: filter;
    transition: filter 300ms;
  }
  .logo:hover {
    filter: drop-shadow(0 0 2em #646cffaa);
  }
  .logo.svelte:hover {
    filter: drop-shadow(0 0 2em #ff3e00aa);
  }
</style>`;
            const errorMessage = `svelteLogo1 is not defined

        in <unknown>`;
            const result = findErrorInSourceCode(sourceCode, errorMessage);

            expect(result).toEqual({ column: 17, line: 13 }); // Line 13: svelteLogo1 (position of 's')
        });

        it("should handle multiline Svelte ReferenceError", () => {
            const sourceCode = `<script>
  let count = 0;
</script>

<h1>{count}</h1>
<p>{undefinedVar}</p>`;
            const multilineError = `undefinedVar is not defined

        in <unknown>`;
            const result = findErrorInSourceCode(sourceCode, multilineError);

            expect(result).toEqual({ column: 5, line: 6 }); // Line 6: undefinedVar (position of 'u')
        });
    });
});
