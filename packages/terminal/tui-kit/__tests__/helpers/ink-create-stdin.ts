import EventEmitter from "node:events";

import { vi } from "vitest";

export const createStdin = (): NodeJS.WriteStream => {
    // EventEmitter is required here for Node.js stream compatibility
    const stdin = new EventEmitter() as unknown as NodeJS.WriteStream;

    stdin.isTTY = true;
    // Define properties before spying since EventEmitter doesn't have these natively
    (stdin as Record<string, unknown>).setRawMode = () => stdin;
    (stdin as Record<string, unknown>).read = () => undefined;
    vi.spyOn(stdin, "setRawMode").mockImplementation(() => stdin);
    stdin.setEncoding = () => stdin;
    vi.spyOn(stdin, "read").mockImplementation();
    stdin.unref = () => stdin;
    stdin.ref = () => stdin;

    return stdin;
};

export const emitReadable = (stdin: NodeJS.WriteStream, chunk: string): void => {
    const read = stdin.read as ReturnType<typeof vi.fn>;

    read.mockReturnValueOnce(chunk);
    read.mockReturnValueOnce(null);
    stdin.emit("readable");
    read.mockReset();
};
