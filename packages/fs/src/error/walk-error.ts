// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// Documentation and interface for walk were adapted from Go
// https://golang.org/pkg/path/filepath/#Walk
// Copyright 2009 The Go Authors. All rights reserved. BSD license.

/** Error thrown in {@linkcode walk} or {@linkcode walkSync} during iteration. */
class WalkError extends Error {
    /** File path of the root that's being walked. */
    public root: string;

    /** Constructs a new instance. */
    public constructor(cause: unknown, root: string) {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        super(`${cause instanceof Error ? cause.message : cause} for path "${root}"`);

        this.cause = cause;
        this.root = root;
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/class-literal-property-style
    public override get name(): string {
        return "WalkError";
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/explicit-module-boundary-types
    public override set name(_name) {
        throw new Error("Cannot overwrite name of WalkError");
    }
}

export default WalkError;
