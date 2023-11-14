// eslint-disable-next-line import/no-unused-modules
interface CustomMatchers<R = unknown> {
    toMatchStackFrame: (
        expected: [
            string?,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            any?,
            string?,
            number?,
            number?,
            boolean?,
            boolean?,
            boolean?,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            [string?, any?, string?, number?, number?, boolean?, boolean?, boolean?],
        ],
    ) => R;
}

declare module "vitest" {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type Assertion<T = any> = CustomMatchers<T>;
    type AsymmetricMatchersContaining = CustomMatchers;
}
