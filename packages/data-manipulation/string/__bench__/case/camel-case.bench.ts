/* eslint-disable e18e/ban-dependencies */
import { camelCase } from "@visulima/string/case";
import { camelCase as caseAnythingCamelCase } from "case-anything";
import { camelCase as changeCaseCamel } from "change-case";
import { camelCase as lodashCamelCase } from "lodash";
import { camelCase as sculeCamelCase } from "scule";
import { camelCase as stringTsCamelCase } from "string-ts";
import { describe, test } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../../__fixtures__/test-strings";

describe("camelCase", () => {
    test("visulima/string camelCase (no cache)", async ({ bench }) => {
        await bench("visulima/string camelCase (no cache)", () => {
            for (const stringValue of TEST_STRINGS) {
                camelCase(stringValue);
            }
        }).run();
    });

    test("visulima/string camelCase (with cache)", async ({ bench }) => {
        await bench("visulima/string camelCase (with cache)", () => {
            for (const stringValue of TEST_STRINGS) {
                camelCase(stringValue, { cache: true });
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("lodash camelCase", async ({ bench }) => {
        await bench("lodash camelCase", () => {
            for (const stringValue of TEST_STRINGS) {
                lodashCamelCase(stringValue);
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("case-anything camelCase", async ({ bench }) => {
        await bench("case-anything camelCase", () => {
            for (const stringValue of TEST_STRINGS) {
                caseAnythingCamelCase(stringValue);
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("string-ts camelCase", async ({ bench }) => {
        await bench("string-ts camelCase", () => {
            for (const stringValue of TEST_STRINGS) {
                stringTsCamelCase(stringValue);
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("scule camelCase", async ({ bench }) => {
        await bench("scule camelCase", () => {
            for (const stringValue of TEST_STRINGS) {
                sculeCamelCase(stringValue);
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("change-case camelCase", async ({ bench }) => {
        await bench("change-case camelCase", () => {
            for (const stringValue of TEST_STRINGS) {
                changeCaseCamel(stringValue);
            }
        }).run();
    });

    describe("Special characters handling", () => {
        test("visulima/string camelCase (no cache)", async ({ bench }) => {
            await bench("visulima/string camelCase (no cache)", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    camelCase(stringValue);
                }
            }).run();
        });

        test("visulima/string camelCase (with cache)", async ({ bench }) => {
            await bench("visulima/string camelCase (with cache)", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    camelCase(stringValue, { cache: true });
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("lodash camelCase", async ({ bench }) => {
            await bench("lodash camelCase", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    lodashCamelCase(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("case-anything camelCase", async ({ bench }) => {
            await bench("case-anything camelCase", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    caseAnythingCamelCase(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("scule camelCase", async ({ bench }) => {
            await bench("scule camelCase", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    sculeCamelCase(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("change-case camelCase", async ({ bench }) => {
            await bench("change-case camelCase", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    changeCaseCamel(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("string-ts camelCase", async ({ bench }) => {
            await bench("string-ts camelCase", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    stringTsCamelCase(stringValue);
                }
            }).run();
        });
    });

    describe("Acronym handling", () => {
        test("visulima/string camelCase (no cache)", async ({ bench }) => {
            await bench("visulima/string camelCase (no cache)", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    camelCase(stringValue);
                }
            }).run();
        });

        test("visulima/string camelCase (with cache)", async ({ bench }) => {
            await bench("visulima/string camelCase (with cache)", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    camelCase(stringValue, { cache: true });
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("lodash camelCase", async ({ bench }) => {
            await bench("lodash camelCase", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    lodashCamelCase(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("case-anything camelCase", async ({ bench }) => {
            await bench("case-anything camelCase", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    caseAnythingCamelCase(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("scule camelCase", async ({ bench }) => {
            await bench("scule camelCase", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    sculeCamelCase(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("change-case camelCase", async ({ bench }) => {
            await bench("change-case camelCase", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    changeCaseCamel(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("string-ts camelCase", async ({ bench }) => {
            await bench("string-ts camelCase", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    stringTsCamelCase(stringValue);
                }
            }).run();
        });
    });
});
