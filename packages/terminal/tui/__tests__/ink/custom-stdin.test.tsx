import process from "node:process";
import { PassThrough } from "node:stream";

import { describe, expect, it, vi } from "vitest";

import { Text } from "../../src/components/index";
import { useFocus } from "../../src/ink/hooks/use-focus";
import { useInput } from "../../src/ink/hooks/use-input";
import { usePaste } from "../../src/ink/hooks/use-paste";
import { useStdin } from "../../src/ink/hooks/use-stdin";
import { render } from "../../src/ink/index";
import createStdout from "../helpers/ink-create-stdout";

const RAW_MODE_ERROR = "Raw mode is not supported on the stdin provided to Ink.";
const PROCESS_STDIN_ERROR = "Raw mode is not supported on the current process.stdin";

const delay = (ms: number): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });

// A PassThrough that reports itself as a TTY and exposes setRawMode, like a real terminal stream.
const createTtyStream = () => {
    const stream = new PassThrough();
    const setRawMode = vi.fn();

    Object.assign(stream, { isTTY: true, setRawMode });

    return stream as PassThrough & {
        isTTY: boolean;
        setRawMode: typeof setRawMode;
    };
};

describe("custom stdin", () => {
    it("rejects waitUntilExit when useInput runs on a plain PassThrough stdin", async () => {
        expect.assertions(1);

        const Input = () => {
            useInput(() => {});

            return <Text>x</Text>;
        };

        const app = render(<Input />, { debug: true, stdin: new PassThrough(), stdout: createStdout() });

        await expect(app.waitUntilExit()).rejects.toThrow(RAW_MODE_ERROR);
    });

    it("rejects waitUntilExit when usePaste runs on a plain PassThrough stdin", async () => {
        expect.assertions(1);

        const Paste = () => {
            usePaste(() => {});

            return <Text>x</Text>;
        };

        const app = render(<Paste />, { debug: true, stdin: new PassThrough(), stdout: createStdout() });

        await expect(app.waitUntilExit()).rejects.toThrow(RAW_MODE_ERROR);
    });

    it("reports isRawModeSupported as false for a PassThrough stdin and keeps useFocus working", async () => {
        expect.assertions(3);

        const stdout = createStdout();
        let rawSupported: boolean | undefined;
        let focused = false;

        const Focus = () => {
            rawSupported = useStdin().isRawModeSupported;
            focused = useFocus({ autoFocus: true }).isFocused;

            return <Text>focus</Text>;
        };

        const app = render(<Focus />, { debug: true, stdin: new PassThrough(), stdout });

        await delay(20);
        app.unmount();

        expect(rawSupported).toBe(false);
        expect(focused).toBe(true);
        await expect(app.waitUntilExit()).resolves.toBeUndefined();
    });

    it("treats a stream with isTTY but no setRawMode as not raw-capable", async () => {
        expect.assertions(2);

        const stdin = new PassThrough() as PassThrough & { isTTY: boolean };

        stdin.isTTY = true;

        let rawSupported: boolean | undefined;
        const Input = () => {
            rawSupported = useStdin().isRawModeSupported;
            useInput(() => {});

            return <Text>x</Text>;
        };

        const app = render(<Input />, { debug: true, stdin, stdout: createStdout() });

        expect(rawSupported).toBe(false);
        await expect(app.waitUntilExit()).rejects.toThrow(RAW_MODE_ERROR);
    });

    it("delivers input written to a TTY-shaped custom stream to useInput", async () => {
        expect.assertions(2);

        const stdin = createTtyStream();
        const received: string[] = [];
        const Input = () => {
            useInput((input) => {
                received.push(input);
            });

            return <Text>x</Text>;
        };

        const app = render(<Input />, { debug: true, stdin, stdout: createStdout() });

        await delay(20);
        stdin.write("a");
        await delay(20);
        app.unmount();

        expect(received).toContain("a");
        expect(stdin.setRawMode).toHaveBeenCalledWith(true);
    });

    it("moves focus on Tab for a TTY-shaped custom stream", async () => {
        expect.assertions(2);

        const stdin = createTtyStream();
        const focused: Record<string, boolean> = {};
        const Item = ({ id }: { readonly id: string }) => {
            focused[id] = useFocus({ autoFocus: id === "first", id }).isFocused;

            return <Text>{id}</Text>;
        };

        const app = render(
            <>
                <Item id="first" />
                <Item id="second" />
            </>,
            { debug: true, stdin, stdout: createStdout() },
        );

        await delay(20);

        expect(focused.first).toBe(true);

        stdin.write("\t");
        await delay(20);
        app.unmount();

        expect(focused.second).toBe(true);
    });

    // Only meaningful when the test runner's process.stdin is not a TTY.
    it.skipIf(process.stdin.isTTY)("throws for process.stdin without a TTY, naming process.stdin", async () => {
        expect.assertions(1);

        const Input = () => {
            useInput(() => {});

            return <Text>x</Text>;
        };

        const app = render(<Input />, { debug: true, stdin: process.stdin, stdout: createStdout() });

        await expect(app.waitUntilExit()).rejects.toThrow(PROCESS_STDIN_ERROR);
    });
});
