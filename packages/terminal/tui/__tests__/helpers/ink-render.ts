import { act } from "react";

import { render } from "../../src/ink/index";
import createStdout from "./ink-create-stdout";

type RenderToStringOptions = {
    columns?: number;
    isScreenReaderEnabled?: boolean;
};

export const renderToString = (node: React.JSX.Element, options?: RenderToStringOptions): string => {
    const stdout = createStdout(options?.columns ?? 100);

    render(node, { debug: true, isScreenReaderEnabled: options?.isScreenReaderEnabled, stdout });

    return stdout.get();
};

export const renderToStringAsync = async (node: React.JSX.Element, options?: RenderToStringOptions): Promise<string> => {
    const stdout = createStdout(options?.columns ?? 100);

    await act(() => {
        render(node, { concurrent: true, debug: true, isScreenReaderEnabled: options?.isScreenReaderEnabled, stdout });
    });

    return stdout.get();
};
