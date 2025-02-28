import { bench, describe } from "vitest";
import { snakeCase as lodashSnakeCase } from "lodash";
import { snakeCase as caseAnythingSnakeCase } from "case-anything";
import { snakeCase as sculeSnakeCase } from "scule";
import { snakeCase as changeCaseSnake } from "change-case";
import { snakeCase } from "../dist/case";
import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../__fixtures__/test-strings";

describe("snakeCase", () => {
    bench("visulima/string snakeCase (no cache)", () => {
        for (const str of TEST_STRINGS) {
            snakeCase(str);
        }
    });

    bench("visulima/string snakeCase (with cache)", () => {
        for (const str of TEST_STRINGS) {
            snakeCase(str, { cache: true });
        }
    });

    bench("lodash snakeCase", () => {
        for (const str of TEST_STRINGS) {
            lodashSnakeCase(str);
        }
    });

    bench("case-anything snakeCase", () => {
        for (const str of TEST_STRINGS) {
            caseAnythingSnakeCase(str);
        }
    });

    bench("scule snakeCase", () => {
        for (const str of TEST_STRINGS) {
            sculeSnakeCase(str);
        }
    });

    bench("change-case snakeCase", () => {
        for (const str of TEST_STRINGS) {
            changeCaseSnake(str);
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string snakeCase (no cache)", () => {
            for (const str of SPECIAL_STRINGS) {
                snakeCase(str);
            }
        });

        bench("lodash snakeCase", () => {
            for (const str of SPECIAL_STRINGS) {
                lodashSnakeCase(str);
            }
        });

        bench("case-anything snakeCase", () => {
            for (const str of SPECIAL_STRINGS) {
                caseAnythingSnakeCase(str);
            }
        });

        bench("scule snakeCase", () => {
            for (const str of SPECIAL_STRINGS) {
                sculeSnakeCase(str);
            }
        });

        bench("change-case snakeCase", () => {
            for (const str of SPECIAL_STRINGS) {
                changeCaseSnake(str);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string snakeCase (no cache)", () => {
            for (const str of ACRONYM_STRINGS) {
                snakeCase(str);
            }
        });

        bench("lodash snakeCase", () => {
            for (const str of ACRONYM_STRINGS) {
                lodashSnakeCase(str);
            }
        });

        bench("case-anything snakeCase", () => {
            for (const str of ACRONYM_STRINGS) {
                caseAnythingSnakeCase(str);
            }
        });

        bench("scule snakeCase", () => {
            for (const str of ACRONYM_STRINGS) {
                sculeSnakeCase(str);
            }
        });

        bench("change-case snakeCase", () => {
            for (const str of ACRONYM_STRINGS) {
                changeCaseSnake(str);
            }
        });
    });
});
