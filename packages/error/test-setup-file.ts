// eslint-disable-next-line import/no-extraneous-dependencies,import/no-unused-modules
import { expect } from "vitest";

import type { Trace } from "./src";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExpectedStackFrame = [string?, any[]?, string?, number?, number?, boolean?, boolean?, boolean?, ExpectedStackFrame?];

interface CustomMatchers<R = unknown> {
    toMatchStackFrame: (expected: ExpectedStackFrame) => R;
}

declare module "vitest" {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type Assertion<T = any> = CustomMatchers<T>;
    type AsymmetricMatchersContaining = CustomMatchers;
}

const validateArrays = (
    expected: unknown[],
    received: unknown[],
):
    | {
          message: () => string;
          pass: boolean;
      }
    | undefined => {
    if (expected.length !== received.length) {
        return {
            message: () => `received args and expected args do not have the same length`,
            pass: false,
        };
    }

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const [index, element] of expected.entries()) {
        // eslint-disable-next-line security/detect-object-injection
        if (element !== received[index]) {
            return {
                // eslint-disable-next-line security/detect-object-injection
                message: () => `Element ${JSON.stringify(element)} at index ${index} does not match ${JSON.stringify(received[index])}`,
                pass: false,
            };
        }
    }

    return undefined;
};

const toMatchStackFrame: (
    received: Trace,
    [function_, arguments_, file, lineNumber, columnNumber, isNative, isEval, isInternal, evalOrigin]: ExpectedStackFrame,
) => {
    message: () => string;
    pass: boolean;
} = (
    received,
    [function_, arguments_ = [], file, lineNumber, columnNumber, isNative = false, isEval = false, isInternal, evalOrigin],
): {
    message: () => string;
    pass: boolean;
} => {
    let pass =
        received.methodName === function_ &&
        received.file === file &&
        received.line === lineNumber &&
        received.column === columnNumber &&
        received.isNative === isNative &&
        received.isEval === isEval &&
        received.isInternal === isInternal;

    const validatedArguments = validateArrays(
        [...arguments_].sort((a, b) => a - b),
        [...received.args].sort((a, b) => a - b),
    );

    if (validatedArguments) {
        return validatedArguments;
    }

    if (evalOrigin) {
        const { pass: evalPass } = toMatchStackFrame(received.evalOrigin, evalOrigin);

        pass = evalPass;
    }

    if (pass) {
        return {
            message: () => `expected ${JSON.stringify(received)} not to match stack frame`,
            pass: true,
        };
    }

    return {
        message: () =>
            `expected ${JSON.stringify(received)} to match stack frame ${JSON.stringify({
                args: arguments_,
                column: columnNumber,
                evalOrigin: evalOrigin
                    ? {
                          args: evalOrigin[1],
                          column: evalOrigin[4],
                          file: evalOrigin[2],
                          isEval: true,
                          line: evalOrigin[3],
                          methodName: evalOrigin[0],
                      }
                    : undefined,
                file,
                isEval,
                isNative,
                line: lineNumber,
                methodName: function_,
            })}`,
        pass: false,
    };
};

expect.extend({
    toMatchStackFrame,
});
