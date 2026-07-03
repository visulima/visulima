import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/error-test")({
    component: ErrorTestPage,
});

function ErrorTestPage() {
    const triggerSimpleError = () => {
        try {
            throw new Error("This is a simple test error from line " + new Error().stack?.split("\n")[1]?.match(/:(\d+):/)?.[1]);
        } catch (error) {
            // Send error directly to our overlay system to bypass React's error boundaries
            if (typeof window !== "undefined" && (window as any).__flameSendError) {
                (window as any).__flameSendError(error);
            }
            throw error; // Re-throw to still trigger React's error handling if needed
        }
    };

    const triggerCauseChainError = () => {
        try {
            // This will create a nested error with cause chain
            function innerFunction() {
                throw new Error("Inner error from line " + new Error().stack?.split("\n")[1]?.match(/:(\d+):/)?.[1]);
            }

            function middleFunction() {
                try {
                    innerFunction();
                } catch (error) {
                    const causeError = new Error("Middle error from line " + new Error().stack?.split("\n")[1]?.match(/:(\d+):/)?.[1]);
                    causeError.cause = error;
                    throw causeError;
                }
            }

            middleFunction();
        } catch (error) {
            const outerError = new Error("Outer error from line " + new Error().stack?.split("\n")[1]?.match(/:(\d+):/)?.[1]);
            outerError.cause = error;
            throw outerError;
        }
    };

    const triggerAsyncError = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));

        try {
            // Simulate an async error with cause chain
            await fetch("https://non-existent-endpoint2314654.com1");
        } catch (fetchError) {
            const apiError = new Error("API error from line " + new Error().stack?.split("\n")[1]?.match(/:(\d+):/)?.[1]);
            apiError.cause = fetchError;
            throw apiError;
        }
    };

    const triggerComplexError = () => {
        // Create a deeply nested cause chain
        function createNestedError(depth: number): Error {
            if (depth === 0) {
                return new Error(`Base error at depth ${depth} from line ` + new Error().stack?.split("\n")[1]?.match(/:(\d+):/)?.[1]);
            }

            try {
                return createNestedError(depth - 1);
            } catch (error) {
                const newError = new Error(`Error at depth ${depth} from line ` + new Error().stack?.split("\n")[1]?.match(/:(\d+):/)?.[1]);
                newError.cause = error;
                return newError;
            }
        }

        throw createNestedError(3);
    };

    return (
        <div className="mx-auto max-w-4xl p-8">
            <h1 className="mb-8 text-3xl font-bold">Error Overlay Test Page</h1>

            <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-lg bg-white p-6 shadow-md">
                    <h2 className="mb-4 text-xl font-semibold">Simple Error</h2>
                    <p className="mb-4 text-gray-600">Triggers a basic runtime error to test overlay display and source mapping.</p>
                    <button onClick={triggerSimpleError} className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600" data-testid="simple-error-btn">
                        Trigger Simple Error
                    </button>
                </div>

                <div className="rounded-lg bg-white p-6 shadow-md">
                    <h2 className="mb-4 text-xl font-semibold">Cause Chain Error</h2>
                    <p className="mb-4 text-gray-600">Triggers an error with nested cause chain to test multi-error navigation.</p>
                    <button
                        onClick={triggerCauseChainError}
                        className="rounded bg-green-500 px-4 py-2 text-white hover:bg-green-600"
                        data-testid="cause-chain-btn"
                        data-error-trigger
                    >
                        Trigger Cause Chain
                    </button>
                </div>

                <div className="rounded-lg bg-white p-6 shadow-md">
                    <h2 className="mb-4 text-xl font-semibold">Async Error</h2>
                    <p className="mb-4 text-gray-600">Triggers an async error with cause chain from failed API call.</p>
                    <button
                        onClick={triggerAsyncError}
                        className="rounded bg-yellow-500 px-4 py-2 text-white hover:bg-yellow-600"
                        data-testid="async-error-btn"
                    >
                        Trigger Async Error
                    </button>
                </div>

                <div className="rounded-lg bg-white p-6 shadow-md">
                    <h2 className="mb-4 text-xl font-semibold">Complex Nested Error</h2>
                    <p className="mb-4 text-gray-600">Triggers a deeply nested error chain (4 levels) to test complex scenarios.</p>
                    <button onClick={triggerComplexError} className="rounded bg-red-500 px-4 py-2 text-white hover:bg-red-600" data-testid="complex-error-btn">
                        Trigger Complex Error
                    </button>
                </div>
            </div>

            <div className="mt-8 rounded-lg bg-gray-50 p-6">
                <h3 className="mb-4 text-lg font-semibold">Test Instructions</h3>
                <ol className="list-inside list-decimal space-y-2 text-gray-700">
                    <li>Click any button to trigger the corresponding error type</li>
                    <li>The error overlay should appear with proper source mapping</li>
                    <li>For cause chain errors, use navigation buttons to browse through errors</li>
                    <li>Verify that file paths show original source locations (not compiled paths)</li>
                    <li>Test code frame switching between original and compiled views</li>
                    <li>Test overlay closing with close button or ESC key</li>
                </ol>
            </div>

            <div className="mt-8 rounded-lg bg-blue-50 p-6">
                <h3 className="mb-4 text-lg font-semibold">Expected Behavior</h3>
                <ul className="list-inside list-disc space-y-2 text-gray-700">
                    <li>✅ Error overlay appears immediately after error</li>
                    <li>
                        ✅ File paths show original source (e.g., <code>src/routes/error-test.tsx:25</code>)
                    </li>
                    <li>
                        ✅ Not compiled paths (e.g., no <code>vite</code> or <code>node_modules</code> in paths)
                    </li>
                    <li>✅ Code frames display correctly for both original and compiled views</li>
                    <li>✅ Stack traces are readable and clickable</li>
                    <li>✅ Multiple errors can be navigated with prev/next buttons</li>
                    <li>✅ All errors in chain show correct source locations</li>
                </ul>
            </div>
        </div>
    );
}
