import { vi } from "vitest";

import type { Logger } from "../../src/utils";

class MockLogger implements Logger {
    public debug = vi.fn().mockImplementation(console.debug);

    public info = vi.fn().mockImplementation(console.info);

    public warn = vi.fn().mockImplementation(console.warn);

    public error = vi.fn().mockImplementation(console.error);
}

export default MockLogger;
