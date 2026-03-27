import EventEmitter from "node:events";
import { vi } from "vitest";

export type FakeStdout = {
    get: () => string;
    getWrites: () => string[];
} & NodeJS.WriteStream;

const createStdout = (columns?: number, isTTY?: boolean): FakeStdout => {
    const stdout = new EventEmitter() as unknown as FakeStdout;
    stdout.columns = columns ?? 100;
    stdout.isTTY = isTTY ?? true;

    const write = vi.fn();
    stdout.write = write;

    stdout.get = () => write.mock.calls.at(-1)?.[0] as string;
    stdout.getWrites = () => write.mock.calls.map((args) => args[0] as string);

    return stdout;
};

export default createStdout;
