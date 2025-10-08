import { vi } from "vitest";

import type { Logger } from "../../src/utils";

class MockLogger implements Logger {
    // eslint-disable-next-line no-console
    public debug = vi.fn().mockImplementation(console.debug);

    // eslint-disable-next-line no-console
    public info = vi.fn().mockImplementation(console.info);

    // eslint-disable-next-line no-console
    public warn = vi.fn().mockImplementation(console.warn);

    // eslint-disable-next-line no-console
    public error = vi.fn().mockImplementation(console.error);
}

export default MockLogger;
