import type { Instance } from "@visulima/tui";
import { render } from "@visulima/tui";
import { act } from "react";

import createStdout from "./ink-create-stdout";

type TestRenderOptions = {
    columns?: number;
    isScreenReaderEnabled?: boolean;
};

export type TestInstance = Instance & {
    getOutput: () => string;
    rerenderAsync: (node: React.ReactNode) => Promise<void>;
    stdout: ReturnType<typeof createStdout>;
};

export const renderAsync = async (node: React.ReactNode, options: TestRenderOptions = {}): Promise<TestInstance> => {
    const stdout = createStdout(options.columns ?? 100);

    let instance!: Instance;

    await act(() => {
        instance = render(node, {
            concurrent: true,
            debug: true,
            isScreenReaderEnabled: options.isScreenReaderEnabled,
            stdout,
        });
    });

    return {
        ...instance,
        getOutput: () => stdout.get(),
        async rerenderAsync(newNode: React.ReactNode) {
            await act(() => {
                instance.rerender(newNode);
            });
        },
        stdout,
    };
};

export const renderSync = (node: React.ReactNode, options: TestRenderOptions = {}): TestInstance => {
    const stdout = createStdout(options.columns ?? 100);

    const instance = render(node, {
        concurrent: false,
        debug: true,
        isScreenReaderEnabled: options.isScreenReaderEnabled,
        stdout,
    });

    return {
        ...instance,
        getOutput: () => stdout.get(),
        rerenderAsync(newNode: React.ReactNode) {
            instance.rerender(newNode);

            return Promise.resolve();
        },
        stdout,
    };
};
