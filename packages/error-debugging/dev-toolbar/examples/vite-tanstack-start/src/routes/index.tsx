import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
    component: Home,
});

function Home() {
    const throwError = () => {
        setTimeout(() => {
            const cause = new TypeError("Cannot read properties of undefined (reading 'name')");
            const err = new Error("Example error from the TanStack Start dev-toolbar demo");

            err.cause = cause;
            throw err;
        }, 0);
    };

    const rejectPromise = () => {
        void Promise.reject(new Error("Example unhandled rejection from the TanStack Start dev-toolbar demo"));
    };

    return (
        <div className="p-8">
            <h1 className="mb-4 text-3xl font-bold">TanStack Start + Dev Toolbar</h1>
            <p className="mb-6 text-gray-600 dark:text-gray-400">
                Welcome! This example demonstrates{" "}
                <a className="text-cyan-600 underline" href="https://tanstack.com/start" rel="noreferrer" target="_blank">
                    TanStack Start
                </a>{" "}
                with the Visulima Dev Toolbar.
            </p>
            <div className="flex flex-wrap gap-3">
                <button
                    type="button"
                    onClick={throwError}
                    className="rounded bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
                >
                    Throw Error
                </button>
                <button
                    type="button"
                    onClick={rejectPromise}
                    className="rounded bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
                >
                    Unhandled Rejection
                </button>
            </div>
            <p className="mt-8 text-sm text-gray-500">
                Edit <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">src/routes/index.tsx</code> and save to reload.
            </p>
        </div>
    );
}
