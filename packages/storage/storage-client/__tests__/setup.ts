// React Query background refetches can race happy-dom's `teardownWindow`:
// the test's assertions pass, then teardown aborts in-flight fetches and
// restores real `globalThis.fetch`. If a query retries (or a mutation
// settles) on the next tick, it hits the real network against the test
// placeholder URLs (`api.example.com`, happy-dom's default
// `http://localhost:3000` origin) and the rejection bubbles up as an
// uncaught process error — failing the file despite every `expect()`
// passing. Filter only these very specific teardown patterns; real test
// assertion failures still surface normally.
const TEARDOWN_RACE_PATTERNS = [
    "ENOTFOUND",
    "ECONNREFUSED",
    "api.example.com",
    "127.0.0.1:3000",
    "::1:3000",
];

const isTeardownRaceError = (error: unknown): boolean => {
    const message = String((error as { message?: string })?.message ?? error);

    return TEARDOWN_RACE_PATTERNS.some((pattern) => message.includes(pattern));
};

process.on("unhandledRejection", (reason) => {
    if (isTeardownRaceError(reason)) {
        return;
    }

    throw reason;
});
