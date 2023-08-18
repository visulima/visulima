// eslint-disable-next-line import/no-extraneous-dependencies
import petstore from "@readme/oas-examples/3.0/json/petstore.json";
import Oas from "oas";
import { beforeEach, describe, expect, it } from "vitest";

import type { Extensions } from "../../src/utils/oas-extensions";
import {
    CODE_SAMPLES,
    EXPLORER_ENABLED,
    HEADERS,
    PROXY_ENABLED,
    SAMPLES_ENABLED,
    SAMPLES_LANGUAGES,
    SEND_DEFAULTS,
    SIMPLE_MODE,
    defaults,
    getExtension,
    validateExtension,
} from "../../src/utils/oas-extensions";

const extensions: Record<string, keyof Extensions> = {
    CODE_SAMPLES,
    EXPLORER_ENABLED,
    HEADERS,
    PROXY_ENABLED,
    SAMPLES_ENABLED,
    SAMPLES_LANGUAGES,
    SEND_DEFAULTS,
    SIMPLE_MODE,
};

describe("oas-extensions", () => {
    it.each([
        ["CODE_SAMPLES"],
        ["EXPLORER_ENABLED"],
        ["HEADERS"],
        ["PROXY_ENABLED"],
        ["SAMPLES_ENABLED"],
        ["SAMPLES_LANGUAGES"],
        ["SEND_DEFAULTS"],
        ["SIMPLE_MODE"],
    ])("%s should have a default value", (extension) => {
        // eslint-disable-next-line security/detect-object-injection
        expect(defaults).toHaveProperty(extensions[extension]);
    });

    describe("#getExtension", () => {
        it("should not throw an exception if `Oas` doesn't have an API definition", () => {
            const oas = Oas.init(undefined);

            expect(getExtension(SAMPLES_LANGUAGES, oas)).toHaveLength(7);
        });

        it("should not throw an exception if `Operation` doesn't have an API definition", () => {
            const oas = Oas.init(undefined);
            const operation = oas.operation("/pet", "post");

            expect(getExtension(SAMPLES_LANGUAGES, oas, operation)).toHaveLength(7);
        });

        describe("oas-level extensions", () => {
            it("should use the default extension value if the extension is not present", () => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                const oas = Oas.init(petstore);

                expect(getExtension(SAMPLES_LANGUAGES, oas)).toStrictEqual(["shell", "node", "ruby", "php", "python", "java", "csharp"]);
            });

            it("should locate an extensions under `n-readme`", () => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                const oas = Oas.init({
                    ...petstore,
                    "n-readme": {
                        [SAMPLES_LANGUAGES]: ["swift"],
                    },
                });

                expect(getExtension(SAMPLES_LANGUAGES, oas)).toStrictEqual(["swift"]);
            });

            it("should locate an extensions listed at the root", () => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                const oas = Oas.init({ ...petstore, [`n-${EXPLORER_ENABLED}`]: false });

                expect(getExtension(EXPLORER_ENABLED, oas)).toBeFalsy();
            });

            it("should not throw if `n-readme` is not an object", () => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                const oas = Oas.init({
                    ...petstore,
                    "n-readme": true,
                });

                expect(getExtension(SAMPLES_LANGUAGES, oas)).toHaveLength(7);
            });

            it("should not pick up the `code-samples` extension", () => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                const oas = Oas.init({
                    ...petstore,
                    "n-readme": {
                        [CODE_SAMPLES]: [
                            {
                                code: "curl -X POST https://api.example.com/v2/alert",
                                language: "curl",
                                name: "Custom cURL snippet",
                            },
                        ],
                    },
                });

                expect(getExtension(CODE_SAMPLES, oas)).toBeUndefined();
            });
        });

        describe("operation-level", () => {
            let oas: Oas;

            beforeEach(() => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                oas = Oas.init(petstore);
            });

            it("should use the default extension value if the extension is not present", () => {
                const operation = oas.operation("/pet", "post");

                expect(getExtension(SAMPLES_LANGUAGES, oas, operation)).toStrictEqual(["shell", "node", "ruby", "php", "python", "java", "csharp"]);
            });

            it("should locate an extensions under `n-readme`", () => {
                const operation = oas.operation("/pet", "post");

                operation.schema["n-readme"] = {
                    [SAMPLES_LANGUAGES]: ["swift"],
                };

                expect(getExtension(SAMPLES_LANGUAGES, oas, operation)).toStrictEqual(["swift"]);
            });

            it("should locate an extensions listed at the root", () => {
                const operation = oas.operation("/pet", "post");

                operation.schema[`n-${EXPLORER_ENABLED}`] = false;

                expect(getExtension(EXPLORER_ENABLED, oas, operation)).toBeFalsy();
            });

            it("should not throw if `n-readme` is not an object", () => {
                const operation = oas.operation("/pet", "post");

                operation.schema["n-readme"] = true;

                expect(getExtension(SAMPLES_LANGUAGES, oas)).toHaveLength(7);
            });
        });
    });

    describe("#isExtensionValid()", () => {
        it("should validate that `n-readme` is an object", () => {
            expect(() => {
                validateExtension(EXPLORER_ENABLED, Oas.init({ "n-readme": [] }));
            }).toThrow(/must be of type "Object"/);

            expect(() => {
                validateExtension(EXPLORER_ENABLED, Oas.init({ "n-readme": false }));
            }).toThrow(/must be of type "Object"/);

            expect(() => {
                validateExtension(EXPLORER_ENABLED, Oas.init({ "n-readme": null }));
            }).toThrow(/must be of type "Object"/);
        });

        describe.each([
            [
                "CODE_SAMPLES",
                [
                    {
                        code: "curl -X POST https://api.example.com/v2/alert",
                        install: "brew install curl",
                        language: "curl",
                        name: "Custom cURL snippet",
                    },
                ],
                false,
                "Array",
            ],
            ["EXPLORER_ENABLED", true, "false", "Boolean"],
            ["HEADERS", [{ key: "X-API-Key", value: "abc123" }], false, "Array"],
            ["PROXY_ENABLED", true, "yes", "Boolean"],
            ["SAMPLES_ENABLED", true, "no", "Boolean"],
            ["SAMPLES_LANGUAGES", ["swift"], {}, "Array"],
            ["SEND_DEFAULTS", true, "absolutely not", "Boolean"],
            ["SIMPLE_MODE", true, "absolutely not", "Boolean"],
        ])("%s", (extension, validValue, invalidValue, expectedType) => {
            describe("should allow valid extensions", () => {
                it("should allow at the root level", () => {
                    expect(() => {
                        // eslint-disable-next-line security/detect-object-injection
                        validateExtension(extensions[extension], Oas.init({ [`n-${extensions[extension]}`]: validValue }));
                    }).not.toThrow();
                });

                it("should allow if nested in `n-readme`", () => {
                    expect(() => {
                        validateExtension(
                            // eslint-disable-next-line security/detect-object-injection
                            extensions[extension],
                            Oas.init({
                                "n-readme": {
                                    // eslint-disable-next-line security/detect-object-injection
                                    [extensions[extension]]: validValue,
                                },
                            }),
                        );
                    }).not.toThrow();
                });
            });

            describe("should fail on invalid extension values", () => {
                it("should error if at the root level", () => {
                    expect(() => {
                        // eslint-disable-next-line security/detect-object-injection
                        validateExtension(extensions[extension], Oas.init({ [`n-${extensions[extension]}`]: invalidValue }));
                        // eslint-disable-next-line security/detect-object-injection,@rushstack/security/no-unsafe-regexp,security/detect-non-literal-regexp
                    }).toThrow(new RegExp(`"n-${extensions[extension]}" must be of type "${expectedType}"`));
                });

                it("should error if nested in `n-readme`", () => {
                    expect(() => {
                        validateExtension(
                            // eslint-disable-next-line security/detect-object-injection
                            extensions[extension],
                            Oas.init({
                                "n-readme": {
                                    // eslint-disable-next-line security/detect-object-injection
                                    [extensions[extension]]: invalidValue,
                                },
                            }),
                        );
                        // eslint-disable-next-line security/detect-object-injection,@rushstack/security/no-unsafe-regexp,security/detect-non-literal-regexp
                    }).toThrow(new RegExp(`"n-readme.${extensions[extension]}" must be of type "${expectedType}"`));
                });
            });
        });
    });
});
