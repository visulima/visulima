import { describe, test } from "vitest";

import { outdent } from "../src/outdent";

const shortTemplate = `
    This is a short template
    with just a few lines
    to test basic performance.
`;

const mediumTemplate = `
    This is a medium template
    with more lines
    and content to process.
    We want to make sure
    that the outdent function
    can handle this amount of text
    efficiently.
`;

const longTemplate = `
    This is a much longer template
    with many more lines of text
    to test how the outdent function
    scales with larger inputs.

    It includes a mix of:
    - empty lines

    - lines with different indentation levels
      like this one which is indented more
        and this one which is indented even more

    - some very long lines that will test string manipulation performance as well as the ability to correctly identify and remove indentation from strings that span multiple lines in the source code but represent a single line in the output text. These types of lines are common in real-world usage.

    - and finally some short lines again

    To ensure we have a comprehensive benchmark.
`;

const interpolatedTemplate = (value1: string, value2: number) => outdent`
    This template has ${value1}
    and also ${value2}
    to test interpolation performance.
`;

const nestedTemplate = outdent`
    This template uses an outdent call
    within it like this: ${outdent`
        Nested indentation
        should work correctly
    `}
    and continue afterward.
`;

const firstValueIsOutdent = outdent`
    ${outdent}
    This special case where the first value is outdent
    requires special handling.
`;

describe("Outdent Benchmarks", () => {
    // Basic string handling benchmarks
    test("Short string", async ({ bench }) => {
        await bench("Short string", () => {
            outdent(shortTemplate);
        }).run();
    });

    test("Medium string", async ({ bench }) => {
        await bench("Medium string", () => {
            outdent(mediumTemplate);
        }).run();
    });

    test("Long string", async ({ bench }) => {
        await bench("Long string", () => {
            outdent(longTemplate);
        }).run();
    });

    // Interpolation benchmarks
    test("With interpolation", async ({ bench }) => {
        await bench("With interpolation", () => {
            interpolatedTemplate("some values", 42);
        }).run();
    });

    test("With nested outdent", async ({ bench }) => {
        await bench("With nested outdent", () => {
            nestedTemplate;
        }).run();
    });

    test("First value is outdent", async ({ bench }) => {
        await bench("First value is outdent", () => {
            firstValueIsOutdent;
        }).run();
    });

    // API variations
    test("String method", async ({ bench }) => {
        await bench("String method", () => {
            outdent.string(`
            Testing the string method
            which is an alternative API
            for outdenting.
        `);
        }).run();
    });

    test("Custom options", async ({ bench }) => {
        await bench("Custom options", () => {
            outdent({
                newline: "\r\n",
                trimLeadingNewline: false,
                trimTrailingNewline: false,
            })`
            Custom options
            with newline normalization
            and no trimming.
        `;
        }).run();
    });

    // Caching benchmarks
    describe("Caching Options", () => {
        // Create a template that will be used multiple times
        const repeatedTemplate = `
            This template will be used
            multiple times to test
            cache efficiency in different scenarios.
        `;

        // Default caching (enabled)
        test("Default caching", async ({ bench }) => {
            await bench("Default caching", () => {
                outdent(repeatedTemplate);
            }).run();
        });

        // Explicit caching enabled
        test("Explicit cache enabled", async ({ bench }) => {
            await bench("Explicit cache enabled", () => {
                outdent({
                    cache: true,
                })(repeatedTemplate);
            }).run();
        });

        // Cache disabled
        test("Cache disabled", async ({ bench }) => {
            await bench("Cache disabled", () => {
                outdent({
                    cache: false,
                })(repeatedTemplate);
            }).run();
        });

        // Custom cache store
        const customCache = new WeakMap<TemplateStringsArray, string[]>();

        test("Custom cache store", async ({ bench }) => {
            await bench("Custom cache store", () => {
                outdent({
                    cache: true,
                    cacheStore: customCache,
                })(repeatedTemplate);
            }).run();
        });
    });

    // Repeated use benchmark
    test("Repeated use of same template", async ({ bench }) => {
        await bench(
            "Repeated use of same template",
            () => outdent`
            This template will be used
            multiple times to test cache efficiency.
        `,
        ).run();
    });
});
