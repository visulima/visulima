import { act } from "react";
import { render, type Instance } from "../../src/ink/index.js";
import createStdout from "./ink-create-stdout.js";

type TestRenderOptions = {
    columns?: number;
    isScreenReaderEnabled?: boolean;
};

export type TestInstance = Instance & {
    stdout: ReturnType<typeof createStdout>;
    getOutput: () => string;
    rerenderAsync: (node: React.ReactNode) => Promise<void>;
};

export async function renderAsync(node: React.ReactNode, options: TestRenderOptions = {}): Promise<TestInstance> {
    const stdout = createStdout(options.columns ?? 100);

    let instance!: Instance;

    await act(async () => {
        instance = render(node, {
            stdout,
            debug: true,
            concurrent: true,
            isScreenReaderEnabled: options.isScreenReaderEnabled,
        });
    });

    return {
        ...instance,
        stdout,
        getOutput: () => stdout.get(),
        async rerenderAsync(newNode: React.ReactNode) {
            await act(async () => {
                instance.rerender(newNode);
            });
        },
    };
}

export function renderSync(node: React.ReactNode, options: TestRenderOptions = {}): TestInstance {
    const stdout = createStdout(options.columns ?? 100);

    const instance = render(node, {
        stdout,
        debug: true,
        concurrent: false,
        isScreenReaderEnabled: options.isScreenReaderEnabled,
    });

    return {
        ...instance,
        stdout,
        getOutput: () => stdout.get(),
        async rerenderAsync(newNode: React.ReactNode) {
            instance.rerender(newNode);
        },
    };
}
