import { masker } from "@qiwi/masker";
import { redact } from "@visulima/redact";
import fastRedact from "fast-redact";
import fastUnset from "fast-unset";
import { core } from "fast-unset/dist/core";
import unsetValue from "unset-value";
import { describe, test } from "vitest";

const redactObjectBench = fastRedact({
    paths: ["a"],
    remove: true,
});

const redactDeepObjectBench = fastRedact({
    paths: ["a.b.c"],
    remove: true,
});

describe("object", () => {
    test("@visulima/redact", async ({ bench }) => {
        await bench("@visulima/redact", () => {
            const object = {
                a: {
                    b: {
                        c: 1,
                    },
                },
            };

            const output = redact(object, [{ key: "a", replacement: null }]);

            if (typeof output.a === "object") {
                throw new TypeError("Expected a to be '<A>'");
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("fast-redact", async ({ bench }) => {
        await bench("fast-redact", () => {
            const object = {
                a: {
                    b: {
                        c: 1,
                    },
                },
            };

            const output = JSON.parse(redactObjectBench(object) as string);

            if (output.a) {
                throw new Error("Expected a to be empty");
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("unset-value", async ({ bench }) => {
        await bench("unset-value", () => {
            const object = {
                a: {
                    b: {
                        c: 1,
                    },
                },
            };

            unsetValue(object, "a");

            if (object.a) {
                throw new Error("Expected a to be empty");
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("fast-unset (copy)", async ({ bench }) => {
        await bench("fast-unset (copy)", () => {
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
                    a: null,
                },
                { clone: true },
            ) as typeof object;

            if (cloned.a) {
                throw new Error("Expected a to be empty");
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("fast-unset", async ({ bench }) => {
        await bench("fast-unset", () => {
            const object = {
                a: {
                    b: {
                        c: 1,
                    },
                },
            };

            fastUnset(object, {
                a: null,
            });

            if (object.a) {
                throw new Error("Expected a to be empty");
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("fast-unset (bare)", async ({ bench }) => {
        await bench("fast-unset (bare)", () => {
            const object = {
                a: {
                    b: {
                        c: 1,
                    },
                },
            };

            core(object, {
                a: null,
            });

            if (object.a) {
                throw new Error("Expected a to be empty");
            }
        }).run();
    });
});

describe("deep object", () => {
    test("@visulima/redact", async ({ bench }) => {
        await bench("@visulima/redact", () => {
            const object = {
                a: {
                    b: {
                        c: 1,
                    },
                },
            };

            const output = redact(object, [{ key: "a.b.c", replacement: null }]);

            if (output.a.b.c === 1) {
                throw new Error("Expected b in a in object to be '<A.B.C>'");
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("@qiwi/masker", async ({ bench }) => {
        await bench("@qiwi/masker", async () => {
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
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("fast-redact", async ({ bench }) => {
        await bench("fast-redact", () => {
            const object = {
                a: {
                    b: {
                        c: 1,
                    },
                },
            };

            const output = JSON.parse(redactDeepObjectBench(object) as string);

            if (output.a.b.c) {
                throw new Error("Expected b in a in object to be empty");
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("unset-value", async ({ bench }) => {
        await bench("unset-value", () => {
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
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("fast-unset (copy)", async ({ bench }) => {
        await bench("fast-unset (copy)", () => {
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
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("fast-unset", async ({ bench }) => {
        await bench("fast-unset", () => {
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
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("fast-unset (bare)", async ({ bench }) => {
        await bench("fast-unset (bare)", () => {
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
        }).run();
    });
});
