// eslint-disable-next-line import/no-unused-modules
interface CustomMatchers<R = unknown> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toMatchStackFrame: (expected: [string?, any?, string?, number?, number?]) => R;
}

declare module "vitest" {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type Assertion<T = any> = CustomMatchers<T>;
    type AsymmetricMatchersContaining = CustomMatchers;
}
