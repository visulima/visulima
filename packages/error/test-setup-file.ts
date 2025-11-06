import { expect } from "vitest";

import type { Trace } from "./src";

type ExpectedStackFrame = [string?, string?, number?, number?, string?, Trace?];

interface CustomMatchers<R = unknown> {
    toMatchStackFrame: (expected: ExpectedStackFrame) => R;
}

declare module "vitest" {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type Assertion<T = any> = CustomMatchers<T>;
    type AsymmetricMatchersContaining = CustomMatchers;
}

const toMatchStackFrame: (
    received: Trace,
    [function_, file, lineNumber, columnNumber, type, evalOrigin]: ExpectedStackFrame,
) => {
    message: () => string;
    pass: boolean;
} = (
    received,
    [function_, file, lineNumber, columnNumber, type, evalOrigin],
): {
    message: () => string;
    pass: boolean;
} => {
    let pass
        = received.methodName === function_
            && received.file === file
            && received.line === lineNumber
            && received.column === columnNumber
            && received.type === type;

    if ((received.evalOrigin !== undefined && evalOrigin === undefined) || (received.evalOrigin === undefined && evalOrigin !== undefined)) {
        pass = false;
    } else if (received.evalOrigin !== undefined && evalOrigin !== undefined) {
        pass
            = pass
                && received.evalOrigin.methodName === evalOrigin.methodName
                && received.evalOrigin.file === evalOrigin.file
                && received.evalOrigin.line === evalOrigin.line
                && received.evalOrigin.column === evalOrigin.column
                && received.evalOrigin.type === evalOrigin.type;
    }

    if (pass) {
        return {
            message: () => `expected ${JSON.stringify(received)} not to match stack frame`,
            pass: true,
        };
    }

    return {
        actual: {
            column: columnNumber,
            evalOrigin,
            file,
            line: lineNumber,
            methodName: function_,
            type,
        },
        expected: {
            column: received.column,
            evalOrigin: received.evalOrigin,
            file: received.file,
            line: received.line,
            methodName: received.methodName,
            type: received.type,
        },
        message: () =>
            `expected ${JSON.stringify({
                column: received.column,
                evalOrigin: received.evalOrigin,
                file: received.file,
                line: received.line,
                methodName: received.methodName,
                type: received.type,
            })} to match stack frame ${JSON.stringify({
                column: columnNumber,
                evalOrigin,
                file,
                line: lineNumber,
                methodName: function_,
                type,
            })}`,
        pass: false,
    };
};

expect.extend({
    toMatchStackFrame,
});
