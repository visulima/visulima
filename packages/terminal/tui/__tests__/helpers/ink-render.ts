import { act } from "react";
import { render } from "../../src/ink/index.js";
import createStdout from "./ink-create-stdout.js";

type RenderToStringOptions = {
    columns?: number;
    isScreenReaderEnabled?: boolean;
};

export const renderToString = (node: React.JSX.Element, options?: RenderToStringOptions): string => {
    const stdout = createStdout(options?.columns ?? 100);
    render(node, { stdout, debug: true, isScreenReaderEnabled: options?.isScreenReaderEnabled });
    return stdout.get();
};

export const renderToStringAsync = async (node: React.JSX.Element, options?: RenderToStringOptions): Promise<string> => {
    const stdout = createStdout(options?.columns ?? 100);
    await act(async () => {
        render(node, { stdout, debug: true, isScreenReaderEnabled: options?.isScreenReaderEnabled, concurrent: true });
    });
    return stdout.get();
};
