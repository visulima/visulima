/**
 * Some of the tests are copied from https://github.com/zjullion/sensitive-param-filter/blob/master/test/sensitiveParamFilter.test.ts and https://github.com/zjullion/sensitive-param-filter/blob/master/test/sensitiveParamFilter.fixture.ts
 * The MIT License (MIT)
 *
 * Copyright (c) 2019 Alberta Motor Association
 * Copyright (c) 2024 Zach Jullion
 */

// eslint-disable-next-line max-classes-per-file
import { beforeEach, describe, expect, it } from "vitest";

import { redact } from "../../src";
import standardModifierRules from "../../src/rules";

type PlainJsObject = {
    _header: string;
    Authorization: string;
    body: {
        info: string;
        notes: string;
        parent?: PlainJsObject;
        "Private-Data": string;
    };
    method: string;
    numRetries: number;
    password: string;
    stageVariables: null;
    username: string;
};

type SyntaxErrorWithFields = {
    Authorization: string;
    customData: {
        error: Error;
        info: string;
    };
};

type MixedArray = [{ Authorization: string; method: string; url: string }, number, [{ password: string; username: string }, string, MixedArray], string];

describe(redact, () => {
    describe("array", () => {
        describe("filtering nested arrays", () => {
            const mixedArrayInput: MixedArray = [
                { Authorization: "Bearer somedatatoken", method: "GET", url: "https://some.url.org" },
                12_345,
                // @ts-expect-error using null as a placeholder
                [{ password: "qwery123456", username: "alice.smith" }, "Hello World", null],
                "{ \"amount\": 9.75, \"credit_card_number\": \"4551201891449281\" }",
            ];

            mixedArrayInput[2][2] = mixedArrayInput;

            const input = mixedArrayInput;

            const inputLength = input.length;
            const inputIndex2Length = input[2].length;

            // eslint-disable-next-line vitest/require-hook
            let output = input;

            beforeEach(() => {
                output = redact(input, ["password", "authorization", "PrIvAtE", "credit_card_number"]);
            });

            it("does not modify the original object", () => {
                expect.assertions(11);

                expect(input).toHaveLength(inputLength);
                expect(input[2]).toHaveLength(inputIndex2Length);

                expect(input[0].Authorization).toBe("Bearer somedatatoken");
                expect(input[0].method).toBe("GET");
                expect(input[0].url).toBe("https://some.url.org");
                expect(input[1]).toBe(12_345);
                expect(input[2][0].password).toBe("qwery123456");
                expect(input[2][0].username).toBe("alice.smith");
                expect(input[2][1]).toBe("Hello World");
                expect(input[2][2]).toBe(input);
                expect(input[3]).toBe("{ \"amount\": 9.75, \"credit_card_number\": \"4551201891449281\" }");
            });

            it("maintains non-sensitive data in the output object, including circular references", () => {
                expect.assertions(8);

                expect(output).toHaveLength(inputLength);
                expect(output[2]).toHaveLength(inputIndex2Length);

                expect(output[0].method).toBe("GET");
                expect(output[0].url).toBe("https://some.url.org");
                expect(output[1]).toBe(12_345);
                expect(output[2][0].username).toBe("alice.smith");
                expect(output[2][1]).toBe("Hello World");
                expect(output[2][2]).toBe(output);
            });

            it("filters out object keys in a case-insensitive, partial-matching manner", () => {
                expect.assertions(2);

                expect(output[0].Authorization).toBe("<AUTHORIZATION>");
                expect(output[2][0].password).toBe("<PASSWORD>");
            });

            it("filters out JSON keys and matches partials while maintaining non-sensitive data", () => {
                expect.assertions(3);

                const outputIndex3Object = JSON.parse(output[3]) as Record<string, unknown>;

                expect(Object.keys(outputIndex3Object)).toHaveLength(2);

                expect(outputIndex3Object.amount).toBe(9.75);
                expect(outputIndex3Object.credit_card_number).toBe("<CREDIT_CARD_NUMBER>");
            });
        });

        it("should redact sensitive array data with empty modifiers", () => {
            expect.assertions(1);

            const input = [
                1,
                "password",
                3,
                "user",
                {
                    password: "123456",
                    user: {
                        email: "test@example.com",
                        password: "123456",
                    },
                },
            ];

            const result = redact(input, []);

            expect(result).toStrictEqual(input);
        });

        it("should redact sensitive array data with only specified keys", () => {
            expect.assertions(1);

            const input = [
                1,
                "password",
                3,
                "user",
                {
                    password: "123456",
                    user: {
                        email: "test@example.com",
                        password: "123456",
                    },
                },
            ];

            const result = redact(input, [1]);

            expect(result).toStrictEqual([
                1,
                "<REDACTED>",
                3,
                "user",
                {
                    password: "123456",
                    user: {
                        email: "test@example.com",
                        password: "123456",
                    },
                },
            ]);
        });

        it("should redact sensitive array data with deep specified key", () => {
            expect.assertions(1);

            const input = [
                1,
                ["test", "email", 2, "test"],
                3,
                "user",
                {
                    password: "123456",
                    user: {
                        email: "test@example.com",
                        password: "123456",
                    },
                },
            ];

            const result = redact(input, ["1.2"]);

            expect(result).toStrictEqual([
                1,
                ["test", "email", "<1.2>", "test"],
                3,
                "user",
                {
                    password: "123456",
                    user: {
                        email: "test@example.com",
                        password: "123456",
                    },
                },
            ]);
        });

        it("should redact sensitive array and object data with deep specified key", () => {
            expect.assertions(1);

            const input = [
                1,
                ["test", "email", 2, "test"],
                3,
                "user",
                {
                    password: "123456",
                    user: {
                        email: "test@example.com",
                        password: "123456",
                    },
                },
            ];

            const result = redact(input, ["1.2", { deep: true, key: "password" }]);

            expect(result).toStrictEqual([
                1,
                ["test", "email", "<1.2>", "test"],
                3,
                "user",
                {
                    password: "<PASSWORD>",
                    user: {
                        email: "test@example.com",
                        password: "<PASSWORD>",
                    },
                },
            ]);
        });
    });

    describe("object", () => {
        describe("filtering a plain JS object", () => {
            const plainJsInputObject: PlainJsObject = {
                _header: String.raw`GET /some/items\nAuthorization: Bearer someheadertoken`,
                Authorization: "Bearer somedatatoken",
                body: {
                    info: "{ \"first_name\": \"Bob\", \"last_name\": \"Bobbington\", \"PASSWORD\": \"asecurepassword1234\", \"amount\": 4 }",
                    notes: "Use https://login.example.com?username=jon.smith&password=qwerty/?authentic=true to login.",
                    "Private-Data": "somesecretstuff",
                },
                method: "POST",
                numRetries: 6,
                password: "asecurepassword1234",
                stageVariables: null,
                username: "bob.bobbington",
            };

            plainJsInputObject.body.parent = plainJsInputObject;

            const input = plainJsInputObject;

            const numberInputKeys = Object.keys(input).length;
            const numberBodyKeys = Object.keys(input.body).length;

            // eslint-disable-next-line vitest/require-hook
            let output = input;

            beforeEach(() => {
                output = redact(input, ["authorization", "PrIvAtE-Data", "credit_card", ...standardModifierRules]);
            });

            it("does not modify the original object", () => {
                expect.assertions(12);
                expect(Object.keys(input)).toHaveLength(numberInputKeys);
                expect(Object.keys(input.body)).toHaveLength(numberBodyKeys);

                expect(input.password).toBe("asecurepassword1234");
                expect(input.username).toBe("bob.bobbington");
                expect(input.Authorization).toBe("Bearer somedatatoken");
                expect(input.method).toBe("POST");
                expect(input.body["Private-Data"]).toBe("somesecretstuff");
                expect(input.body.info).toBe("{ \"first_name\": \"Bob\", \"last_name\": \"Bobbington\", \"PASSWORD\": \"asecurepassword1234\", \"amount\": 4 }");
                expect(input.body.notes).toBe("Use https://login.example.com?username=jon.smith&password=qwerty/?authentic=true to login.");
                expect(input.body.parent).toStrictEqual(input);
                expect(input.numRetries).toBe(6);
                expect(input.stageVariables).toBeNull();
            });

            it("maintains non-sensitive data in the output object, including circular references", () => {
                expect.assertions(7);

                expect(Object.keys(output)).toHaveLength(numberInputKeys);
                expect(Object.keys(output.body)).toHaveLength(numberBodyKeys);

                expect(output.username).toBe("<USERNAME>");
                expect(output.method).toBe("POST");
                expect(output.body.parent).toStrictEqual(output);
                expect(output.numRetries).toBe(6);
                expect(output.stageVariables).toBeNull();
            });

            it("filters out object keys in a case-insensitive, partial-matching manner", () => {
                expect.assertions(4);

                expect(output.password).toBe("<PASSWORD>");
                expect(output.Authorization).toBe("<AUTHORIZATION>");
                expect(output.body["Private-Data"]).toBe("<PRIVATE-DATA>");
                expect(output._header).toBe(String.raw`GET /some/items\nAuthorization: <TOKEN>`);
            });

            it("filters out JSON keys (case-insensitive) and matches partials while maintaining non-sensitive data", () => {
                expect.assertions(5);

                const outputInfoObject = JSON.parse(output.body.info) as Record<string, unknown>;

                expect(Object.keys(outputInfoObject)).toHaveLength(4);

                expect(outputInfoObject.PASSWORD).toBe("<PASSWORD>");
                expect(outputInfoObject.first_name).toBe("<FIRSTNAME>");
                expect(outputInfoObject.last_name).toBe("Bobbington");
                expect(outputInfoObject.amount).toBe(4);
            });

            it("filters out url params in query strings while maintaining non-sensitive data", () => {
                expect.assertions(1);

                // eslint-disable-next-line no-secrets/no-secrets
                expect(output.body.notes).toBe("Use https://login.example.com?username=<USERNAME>&password=<PASSWORD>/?authentic=true to login.");
            });
        });

        describe("filtering a custom object with read-only and non-enumerable properties", () => {
            class VeryUnusualClass {
                public password: string = "hunter12";

                // @ts-expect-error created in constructor with Reflect.defineProperty()
                public readonly: string;

                // @ts-expect-error created in constructor with Reflect.defineProperty()
                public hidden: string;

                public constructor() {
                    Reflect.defineProperty(this, "readonly", {
                        enumerable: true,
                        value: 42,
                        writable: false,
                    });
                    Reflect.defineProperty(this, "hidden", {
                        enumerable: false,
                        value: "You cannot see me",
                        writable: true,
                    });
                }

                public doSomething() {
                    return `${this.readonly} ${this.hidden}`;
                }
            }

            const input = {
                message: "hello",
                veryUnusualObject: new VeryUnusualClass(),
            };

            const numberInputKeys = Object.keys(input).length;
            const numveryUnusualObjectKeys = Object.keys(input.veryUnusualObject).length;
            const veryUnusualObjectType = typeof input.veryUnusualObject;
            const veryUnusualObjectConstructor = input.veryUnusualObject.constructor;

            // eslint-disable-next-line vitest/require-hook
            let output: typeof input = input;

            beforeEach(() => {
                output = redact(input, ["password", "authorization", "PrIvAtE", "credit_card"]);
            });

            it("does not modify the original object", () => {
                expect.assertions(9);

                expect(Object.keys(input)).toHaveLength(numberInputKeys);
                expect(Object.keys(input.veryUnusualObject)).toHaveLength(numveryUnusualObjectKeys);
                expect(typeof input.veryUnusualObject).toBe(veryUnusualObjectType);
                expect(input.veryUnusualObject.constructor).toBe(veryUnusualObjectConstructor);

                expect(input.message).toBe("hello");
                expect(input.veryUnusualObject.password).toBe("hunter12");
                expect(input.veryUnusualObject.readonly).toBe(42);
                expect(input.veryUnusualObject.hidden).toBe("You cannot see me");
                expect(input.veryUnusualObject.doSomething()).toBe("42 You cannot see me");
            });

            it("maintains non-sensitive, enumerable data in the output object", () => {
                expect.assertions(4);

                expect(Object.keys(output)).toHaveLength(numberInputKeys);
                expect(Object.keys(output.veryUnusualObject)).toHaveLength(numveryUnusualObjectKeys);

                expect(output.message).toBe("hello");
                expect(input.veryUnusualObject.readonly).toBe(42);
            });

            it("filters out object keys in a case-insensitive, partial-matching manner", () => {
                expect.assertions(1);

                expect(output.veryUnusualObject.password).toBe("<PASSWORD>");
            });

            it("does not maintain hidden properties, methods, or type information from the original object", () => {
                expect.assertions(3);

                expect(output.veryUnusualObject.hidden).toBeUndefined();

                expect(output.veryUnusualObject.doSomething).toBeUndefined();
                expect(output.veryUnusualObject.constructor).not.toBe(veryUnusualObjectConstructor);
            });
        });

        it("should redact sensitive object data with empty modifiers", () => {
            expect.assertions(1);

            const input = {
                admin: {
                    user: {
                        email: "test@example.com",
                        note: null,
                        password: "123456",
                    },
                },
                password: "123456",
                user: {
                    email: "test@example.com",
                    note: null,
                    password: "123456",
                },
            };

            const result = redact(input, []);

            expect(result).toStrictEqual(input);
        });

        it("should redact sensitive object data only on explicitly specified key", () => {
            expect.assertions(1);

            const input = {
                admin: {
                    user: {
                        email: "test@example.com",
                        password: "123456",
                    },
                },
                password: "123456",
                user: {
                    email: "test@example.com",
                    password: "123456",
                },
            };

            const result = redact(input, ["password"]);

            expect(result).toStrictEqual({
                admin: {
                    user: {
                        email: "test@example.com",
                        password: "123456",
                    },
                },
                password: "<PASSWORD>",
                user: {
                    email: "test@example.com",
                    password: "123456",
                },
            });
        });

        it("should redact sensitive object data only on explicitly specified keys", () => {
            expect.assertions(1);

            const input = {
                admin: {
                    user: {
                        email: "test@example.com",
                        password: "123456",
                    },
                },
                password: "123456",
                user: {
                    email: "test@example.com",
                    password: "123456",
                },
            };

            const result = redact(input, ["password", "user.password", "admin.user.password"]);

            expect(result).toStrictEqual({
                admin: {
                    user: {
                        email: "test@example.com",
                        password: "<ADMIN.USER.PASSWORD>",
                    },
                },
                password: "<PASSWORD>",
                user: {
                    email: "test@example.com",
                    password: "<USER.PASSWORD>",
                },
            });
        });

        it("should redact sensitive object data with specified key and deep option", () => {
            expect.assertions(1);

            const input = {
                admin: {
                    user: {
                        email: "test@example.com",
                        password: "123456",
                    },
                },
                password: "123456",
                user: {
                    email: "test@example.com",
                    password: "123456",
                },
            };

            const result = redact(input, [{ deep: true, key: "password" }]);

            expect(result).toStrictEqual({
                admin: {
                    user: {
                        email: "test@example.com",
                        password: "<PASSWORD>",
                    },
                },
                password: "<PASSWORD>",
                user: {
                    email: "test@example.com",
                    password: "<PASSWORD>",
                },
            });
        });

        it("should redact sensitive object data with wildcard key", () => {
            expect.assertions(1);

            const input = {
                admin: {
                    user: {
                        email: "test@example.com",
                        password: "123456",
                    },
                },
                password: "123456",
                user: {
                    email: "test@example.com",
                    password: "123456",
                },
            };

            const result = redact(input, ["*.password"]);

            expect(result).toStrictEqual({
                admin: {
                    user: {
                        email: "test@example.com",
                        password: "<*.PASSWORD>",
                    },
                },
                password: "123456",
                user: {
                    email: "test@example.com",
                    password: "<*.PASSWORD>",
                },
            });
        });

        it("should redact sensitive object data with wildcard key and replacement", () => {
            expect.assertions(1);

            const input = {
                admin: {
                    user: {
                        email: "test@example.com",
                        password: "123456",
                    },
                },
                password: "123456",
                user: {
                    email: "test@example.com",
                    password: "123456",
                },
            };

            const result = redact(input, [{ key: "*.password", replacement: "<PASSWORD>" }]);

            expect(result).toStrictEqual({
                admin: {
                    user: {
                        email: "test@example.com",
                        password: "<PASSWORD>",
                    },
                },
                password: "123456",
                user: {
                    email: "test@example.com",
                    password: "<PASSWORD>",
                },
            });
        });

        describe("filtering errors with a code", () => {
            class ErrorWithCode extends Error {
                public code: string;

                public constructor(message: string, code: string) {
                    super(message);
                    this.code = code;
                }
            }

            const input = new ErrorWithCode("Something broke", "ERR_BROKEN");

            // eslint-disable-next-line vitest/require-hook
            let output: ErrorWithCode = input;

            beforeEach(() => {
                output = redact(input, ["password", "authorization", "PrIvAtE", "credit_card"]);
            });

            it("maintains the error code and type", () => {
                expect.assertions(2);

                expect(output).toBeInstanceOf(Error);
                expect(output.code).toBe(input.code);
            });

            it("preprends error type to the message", () => {
                expect.assertions(1);

                expect(output.message).toBe(input.message);
            });
        });

        describe("filtering a custom error with non-standard fields", () => {
            class CustomError extends Error {
                public password: string;

                // @ts-expect-error created in constructor with Reflect.defineProperty()
                public readonly: number;

                // @ts-expect-error created in constructor with Reflect.defineProperty()
                public hidden: string;

                public constructor(message: string, password: string, readonly: number, hidden: string) {
                    super(message);

                    this.password = password;
                    Object.defineProperties(this, {
                        hidden: {
                            enumerable: false,
                            value: hidden,
                            writable: true,
                        },
                        name: {
                            enumerable: false,
                            value: this.constructor.name,
                            writable: false,
                        },
                        readonly: {
                            enumerable: true,
                            value: readonly,
                            writable: false,
                        },
                    });
                }
            }

            const inputMessage = "Super broken";
            const inputPassword = "hunter12";
            const inputReadonly = 42;
            const inputHidden = "You cannot see me";

            const input = new CustomError(inputMessage, inputPassword, inputReadonly, inputHidden);
            const inputKeyCount = Object.keys(input).length;
            const inputType = typeof input;
            const inputConstructor = input.constructor;

            // eslint-disable-next-line vitest/require-hook
            let output = new CustomError("", "", 0, "");

            beforeEach(() => {
                output = redact(input, ["password", "authorization", "PrIvAtE", "credit_card"]);
            });

            it("does not modify the original error", () => {
                expect.assertions(7);

                expect(Object.keys(input)).toHaveLength(inputKeyCount);
                expect(typeof input).toBe(inputType);
                expect(input.constructor).toBe(inputConstructor);

                expect(input.message).toBe(inputMessage);
                expect(input.password).toBe(inputPassword);
                expect(input.readonly).toBe(inputReadonly);
                expect(input.hidden).toBe(inputHidden);
            });

            it("preprends error type to the message", () => {
                expect.assertions(1);

                expect(output.message).toBe(inputMessage);
            });

            it("maintains non-sensitive, enumerable data in the output error", () => {
                expect.assertions(1);

                expect(output.readonly).toBe(inputReadonly);
            });

            it("does not maintain sensitive data in the output error", () => {
                expect.assertions(1);

                expect(output.password).toBe("<PASSWORD>");
            });

            it("maintains name and stack values", () => {
                expect.assertions(2);

                expect(output.name).toBe("CustomError");
                expect(output.stack).toBe(input.stack);
            });

            it("converts to a plain Error", () => {
                expect.assertions(1);

                expect(output.constructor).toBe(Error);
            });

            it("does not maintain hidden properties from the original error", () => {
                expect.assertions(1);

                expect(output.hidden).toBeUndefined();
            });
        });

        describe("filtering Maps and Sets", () => {
            const complexKey = { privateStuff: "aKeyThing", public: "anotherKeyThing" };
            const complexValue = { privateStuff: "aValueThing", public: complexKey };

            const input = {
                map: new Map<string | typeof complexKey, number | string | typeof complexValue>([
                    ["password", "aSecurePassword"],
                    ["someNumber", 1_234_567],
                    [complexKey, complexValue],
                ]),
                set: new Set(["apple", "banana", complexKey]),
            };

            // eslint-disable-next-line vitest/require-hook
            let output = input;

            beforeEach(() => {
                output = redact(input, ["password", "authorization", "PrIvAtE", "privateStuff", "credit_card"]);
            });

            it("does not modify the original object", () => {
                expect.assertions(6);

                expect(input.map.get("someNumber")).toBe(1_234_567);
                expect(input.map.get("password")).toBe("aSecurePassword");
                expect(input.map.get(complexKey)).toBe(complexValue);

                expect(input.set).toContain("apple");
                expect(input.set).toContain("banana");
                expect(input.set).toContain(complexKey);
            });

            it("maintains non-sensitive data in the output object", () => {
                expect.assertions(3);

                expect(output.map.get("someNumber")).toBe(1_234_567);

                expect(output.set).toContain("apple");
                expect(output.set).toContain("banana");
            });

            it("filters out object keys in a case-insensitive, partial-matching manner", () => {
                expect.assertions(5);

                const filteredComplexKey = { privateStuff: "<PRIVATESTUFF>", public: "anotherKeyThing" };
                const filteredComplexValue = { privateStuff: "<PRIVATESTUFF>", public: filteredComplexKey };

                expect(output.map.get("password")).toBe("<PASSWORD>");
                expect(output.map.get(complexKey)).toBeUndefined();
                expect([...output.map]).toStrictEqual([
                    ["password", "<PASSWORD>"],
                    ["someNumber", 1_234_567],
                    [filteredComplexKey, filteredComplexValue],
                ]);

                expect(output.set).not.toContain(complexKey);
                expect(output.set).toContainEqual({ privateStuff: "<PRIVATESTUFF>", public: "anotherKeyThing" });
            });
        });
    });

    describe("string", () => {
        it("should anonymize a string", () => {
            expect.assertions(1);

            const input = "John Doe will be 30 on 2024-06-10.";
            const result = redact(input, standardModifierRules);

            expect(result).toMatch("<FIRSTNAME> <LASTNAME> will be 30 on <DATE>");
        });

        describe("filtering a JSON parse error", () => {
            // eslint-disable-next-line vitest/require-hook,unicorn/error-message
            let jsonParseError = new SyntaxError();

            try {
                JSON.parse("This is not a JSON string.  Do not parse it.");
            } catch (error) {
                if (error instanceof SyntaxError) {
                    jsonParseError = error;
                }
            }

            const customJsonParseError = jsonParseError as SyntaxError & SyntaxErrorWithFields;

            customJsonParseError.Authorization = "Username: Bob, Password: pa$$word";
            customJsonParseError.customData = {
                error: customJsonParseError,
                info: "{ \"json\": false, \"veryPrivateInfo\": \"credentials\" }",
            };

            const input = customJsonParseError;

            const inputMessage = input.message;
            const inputStack = input.stack;

            const numberInputKeys = Object.keys(input).length;
            const numberCustomDataKeys = Object.keys(input.customData).length;
            const inputType = typeof input;
            const inputConstructor = input.constructor;

            // eslint-disable-next-line vitest/require-hook
            let output = input;

            beforeEach(() => {
                output = redact(input, ["password", "authorization", "PrIvAtE", "credit_card", "veryPrivateInfo"]);
            });

            it("does not modify the original error", () => {
                expect.assertions(9);

                expect(Object.keys(input)).toHaveLength(numberInputKeys);
                expect(Object.keys(input.customData)).toHaveLength(numberCustomDataKeys);
                expect(typeof input).toBe(inputType);
                expect(input.constructor).toBe(inputConstructor);

                expect(input.message).toBe(inputMessage);
                expect(input.stack).toBe(inputStack);

                expect(input.Authorization).toBe("Username: Bob, Password: pa$$word");
                expect(input.customData.info).toBe("{ \"json\": false, \"veryPrivateInfo\": \"credentials\" }");
                expect(input.customData.error).toBe(input);
            });

            it("converts to a plain Error", () => {
                expect.assertions(1);

                expect(output.constructor).toBe(Error);
            });

            it("maintains non-sensitive data in the output, including circular references", () => {
                expect.assertions(4);

                expect(Object.keys(output)).toHaveLength(numberInputKeys);
                expect(typeof output).toBe(inputType);
                expect(output.stack).toBe(inputStack);
                expect(output.customData.error).toStrictEqual(output);
            });

            it("filters out error keys in a case-insensitive, partial-matching manner", () => {
                expect.assertions(1);

                expect(output.Authorization).toBe("<AUTHORIZATION>");
            });

            it("filters out JSON keys (case-insensitive) and matches partials while maintaining non-sensitive data", () => {
                expect.assertions(3);

                const outputInfoObject = JSON.parse(output.customData.info) as Record<string, unknown>;

                expect(Object.keys(outputInfoObject)).toHaveLength(2);

                expect(outputInfoObject.veryPrivateInfo).toBe("<VERYPRIVATEINFO>");
                expect(outputInfoObject.json).toBe(false);
            });
        });
    });

    it("should return the same value without rounding it", () => {
        expect.assertions(1);

        const bigInt = "987654321987654321";
        const output = redact(bigInt, []);

        expect(output).toStrictEqual(bigInt);
    });

    it("should exclude a rule from the rules list", () => {
        expect.assertions(1);

        const input = "John Doe will be 30 on 2024-06-10.";
        const result = redact(input, standardModifierRules, { exclude: ["firstname"] });

        expect(result).toMatch("John <LASTNAME> will be 30 on <DATE>");
    });
});
