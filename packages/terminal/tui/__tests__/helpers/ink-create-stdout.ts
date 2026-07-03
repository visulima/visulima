import EventEmitter from "node:events";

import { vi } from "vitest";

// EventEmitter is required here for Node.js stream compatibility
const createStdout = (columns?: number, isTTY?: boolean, rows?: number): FakeStdout => {
    const stdout = new EventEmitter() as unknown as FakeStdout;

    stdout.columns = columns ?? 100;
    stdout.isTTY = isTTY ?? true;

    if (rows !== undefined) {
        stdout.rows = rows;
    }

    const write = vi.fn<(...args: unknown[]) => boolean>();

    stdout.write = write;

    stdout.get = () => write.mock.calls.at(-1)?.[0] as string;
    stdout.getWrites = () => write.mock.calls.map((args) => args[0] as string);

    return stdout;
};

export type FakeStdout = NodeJS.WriteStream & {
    get: () => string;
    getWrites: () => string[];
};

export default createStdout;
