/* eslint-disable e18e/ban-dependencies */
import { snakeCase } from "@visulima/string/case";
import { snakeCase as caseAnythingSnakeCase } from "case-anything";
import { snakeCase as changeCaseSnake } from "change-case";
import { snakeCase as lodashSnakeCase } from "lodash";
import { snakeCase as sculeSnakeCase } from "scule";
import { snakeCase as stringTsSnakeCase } from "string-ts";
import { describe, test } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../../__fixtures__/test-strings";

describe("snakeCase", () => {
    test("visulima/string snakeCase (no cache)", async ({ bench }) => {
        await bench("visulima/string snakeCase (no cache)", () => {
            for (const stringValue of TEST_STRINGS) {
                snakeCase(stringValue);
            }
        }).run();
    });

    test("visulima/string snakeCase (with cache)", async ({ bench }) => {
        await bench("visulima/string snakeCase (with cache)", () => {
            for (const stringValue of TEST_STRINGS) {
                snakeCase(stringValue, { cache: true });
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("lodash snakeCase", async ({ bench }) => {
        await bench("lodash snakeCase", () => {
            for (const stringValue of TEST_STRINGS) {
                lodashSnakeCase(stringValue);
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("case-anything snakeCase", async ({ bench }) => {
        await bench("case-anything snakeCase", () => {
            for (const stringValue of TEST_STRINGS) {
                caseAnythingSnakeCase(stringValue);
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("string-ts snakeCase", async ({ bench }) => {
        await bench("string-ts snakeCase", () => {
            for (const stringValue of TEST_STRINGS) {
                stringTsSnakeCase(stringValue);
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("scule snakeCase", async ({ bench }) => {
        await bench("scule snakeCase", () => {
            for (const stringValue of TEST_STRINGS) {
                sculeSnakeCase(stringValue);
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("change-case snakeCase", async ({ bench }) => {
        await bench("change-case snakeCase", () => {
            for (const stringValue of TEST_STRINGS) {
                changeCaseSnake(stringValue);
            }
        }).run();
    });

    describe("Special characters handling", () => {
        test("visulima/string snakeCase (no cache)", async ({ bench }) => {
            await bench("visulima/string snakeCase (no cache)", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    snakeCase(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("lodash snakeCase", async ({ bench }) => {
            await bench("lodash snakeCase", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    lodashSnakeCase(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("case-anything snakeCase", async ({ bench }) => {
            await bench("case-anything snakeCase", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    caseAnythingSnakeCase(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("scule snakeCase", async ({ bench }) => {
            await bench("scule snakeCase", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    sculeSnakeCase(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("change-case snakeCase", async ({ bench }) => {
            await bench("change-case snakeCase", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    changeCaseSnake(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("string-ts snakeCase", async ({ bench }) => {
            await bench("string-ts snakeCase", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    stringTsSnakeCase(stringValue);
                }
            }).run();
        });
    });

    describe("Acronym handling", () => {
        test("visulima/string snakeCase (no cache)", async ({ bench }) => {
            await bench("visulima/string snakeCase (no cache)", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    snakeCase(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("lodash snakeCase", async ({ bench }) => {
            await bench("lodash snakeCase", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    lodashSnakeCase(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("case-anything snakeCase", async ({ bench }) => {
            await bench("case-anything snakeCase", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    caseAnythingSnakeCase(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("scule snakeCase", async ({ bench }) => {
            await bench("scule snakeCase", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    sculeSnakeCase(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("change-case snakeCase", async ({ bench }) => {
            await bench("change-case snakeCase", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    changeCaseSnake(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("string-ts snakeCase", async ({ bench }) => {
            await bench("string-ts snakeCase", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    stringTsSnakeCase(stringValue);
                }
            }).run();
        });
    });
});
