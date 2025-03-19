import { snakeCase as caseAnythingSnakeCase } from "case-anything";
import { snakeCase as changeCaseSnake } from "change-case";
import { snakeCase as lodashSnakeCase } from "lodash";
import { snakeCase as sculeSnakeCase } from "scule";
import { bench, describe } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../../__fixtures__/test-strings";
import { snakeCase } from "../../dist/case";

describe("snakeCase", () => {
    bench("visulima/string snakeCase (no cache)", () => {
        for (const stringValue of TEST_STRINGS) {
            snakeCase(stringValue);
        }
    });

    bench("visulima/string snakeCase (with cache)", () => {
        for (const stringValue of TEST_STRINGS) {
            snakeCase(stringValue, { cache: true });
        }
    });

    bench("lodash snakeCase", () => {
        for (const stringValue of TEST_STRINGS) {
            lodashSnakeCase(stringValue);
        }
    });

    bench("case-anything snakeCase", () => {
        for (const stringValue of TEST_STRINGS) {
            caseAnythingSnakeCase(stringValue);
        }
    });

    bench("scule snakeCase", () => {
        for (const stringValue of TEST_STRINGS) {
            sculeSnakeCase(stringValue);
        }
    });

    bench("change-case snakeCase", () => {
        for (const stringValue of TEST_STRINGS) {
            changeCaseSnake(stringValue);
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string snakeCase (no cache)", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                snakeCase(stringValue);
            }
        });

        bench("lodash snakeCase", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                lodashSnakeCase(stringValue);
            }
        });

        bench("case-anything snakeCase", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                caseAnythingSnakeCase(stringValue);
            }
        });

        bench("scule snakeCase", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                sculeSnakeCase(stringValue);
            }
        });

        bench("change-case snakeCase", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                changeCaseSnake(stringValue);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string snakeCase (no cache)", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                snakeCase(stringValue);
            }
        });

        bench("lodash snakeCase", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                lodashSnakeCase(stringValue);
            }
        });

        bench("case-anything snakeCase", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                caseAnythingSnakeCase(stringValue);
            }
        });

        bench("scule snakeCase", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                sculeSnakeCase(stringValue);
            }
        });

        bench("change-case snakeCase", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                changeCaseSnake(stringValue);
            }
        });
    });
});
