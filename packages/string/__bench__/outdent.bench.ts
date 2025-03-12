import { bench, describe } from "vitest";

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
    bench("Short string", () => {
        outdent(shortTemplate);
    });

    bench("Medium string", () => {
        outdent(mediumTemplate);
    });

    bench("Long string", () => {
        outdent(longTemplate);
    });

    // Interpolation benchmarks
    bench("With interpolation", () => {
        interpolatedTemplate("some values", 42);
    });

    bench("With nested outdent", () => {
        nestedTemplate;
    });

    bench("First value is outdent", () => {
        firstValueIsOutdent;
    });

    // API variations
    bench("String method", () => {
        outdent.string(`
            Testing the string method
            which is an alternative API
            for outdenting.
        `);
    });

    bench("Custom options", () => {
        outdent({
            newline: "\r\n",
            trimLeadingNewline: false,
            trimTrailingNewline: false,
        })`
            Custom options
            with newline normalization
            and no trimming.
        `;
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
        bench("Default caching", () => {
            outdent(repeatedTemplate);
        });

        // Explicit caching enabled
        bench("Explicit cache enabled", () => {
            outdent({
                cache: true,
            })(repeatedTemplate);
        });

        // Cache disabled
        bench("Cache disabled", () => {
            outdent({
                cache: false,
            })(repeatedTemplate);
        });

        // Custom cache store
        const customCache = new WeakMap<TemplateStringsArray, string[]>();

        bench("Custom cache store", () => {
            outdent({
                cache: true,
                cacheStore: customCache,
            })(repeatedTemplate);
        });
    });

    // Repeated use benchmark
    bench(
        "Repeated use of same template",
        () => outdent`
            This template will be used
            multiple times to test cache efficiency.
        `,
    );
});
