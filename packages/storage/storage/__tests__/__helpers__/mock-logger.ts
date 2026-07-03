import { vi } from "vitest";

export interface Logger {
    debug: (message?: unknown, ...arguments_: unknown[]) => void;
    error: (message?: unknown, ...arguments_: unknown[]) => void;
    info: (message?: unknown, ...arguments_: unknown[]) => void;
    warn: (message?: unknown, ...arguments_: unknown[]) => void;
}

class MockLogger implements Logger {
    public debug = vi.fn().mockImplementation(console.debug);

    public info = vi.fn().mockImplementation(console.info);

    public warn = vi.fn().mockImplementation(console.warn);

    public error = vi.fn().mockImplementation(console.error);
}

export default MockLogger;
