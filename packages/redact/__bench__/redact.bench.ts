import { bench, describe } from "vitest";

import unsetValue from "unset-value";
import fastRedact from "fast-redact";
import { core } from "fast-unset/dist/core";
import { redact } from "../dist";
import fastUnset from "fast-unset";
import { masker } from "@qiwi/masker";

const redactBench = fastRedact({
    paths: ["a.b.c"],
    remove: true,
});

describe("redact", () => {
    bench("@visulima/redact", () => {
        const object = {
            a: {
                b: {
                    c: null,
                },
            },
        };

        const output = redact(object, [{ key: "a.b.c", replacement: null }]);

        if (output.a.b.c === 1) {
            throw new Error("Expected b in a in object to be '<A.B.C>'");
        }
    });

    bench("@qiwi/masker", async () => {
        const object = {
            a: {
                b: {
                    secret: 1,
                },
            },
        };

        const output = await masker(object);

        if (output.a.b.secret !== "***") {
            throw new Error("Expected b in a in object to be '***'");
        }
    });

    bench("fast-redact", () => {
        let object = {
            a: {
                b: {
                    c: 1,
                },
            },
        };

        const output = JSON.parse(redactBench(object) as string);

        if (output.a.b.c) {
            throw new Error("Expected b in a in object to be empty");
        }
    });

    bench("unset-value", () => {
        const object = {
            a: {
                b: {
                    c: 1,
                },
            },
        };

        unsetValue(object, "a.b.c");

        if (object.a.b.c) {
            throw new Error("Expected b in a in object to be empty");
        }
    });

    bench("fast-unset (copy)", () => {
        const object = {
            a: {
                b: {
                    c: 1,
                },
            },
        };

        const cloned = fastUnset(
            object,
            {
                a: { b: { c: null } },
            },
            { clone: true },
        ) as typeof object;

        if (cloned.a.b.c) {
            throw new Error("Expected b in a in object to be empty");
        }
    });

    bench("fast-unset", () => {
        const object = {
            a: {
                b: {
                    c: 1,
                },
            },
        };

        fastUnset(object, {
            a: { b: { c: null } },
        });

        if (object.a.b.c) {
            throw new Error("Expected b in a in object to be empty");
        }
    });

    bench("fast-unset (bare)", () => {
        const object = {
            a: {
                b: {
                    c: 1,
                },
            },
        };

        core(object, {
            a: { b: { c: null } },
        });

        if (object.a.b.c) {
            throw new Error("Expected b in a in object to be empty");
        }
    });
});
