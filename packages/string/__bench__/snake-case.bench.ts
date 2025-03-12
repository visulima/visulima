import { snakeCase as caseAnythingSnakeCase } from "case-anything";
import { snakeCase as changeCaseSnake } from "change-case";
import { snakeCase as lodashSnakeCase } from "lodash";
import { snakeCase as sculeSnakeCase } from "scule";
import { bench, describe } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../__fixtures__/test-strings";
import { snakeCase } from "../dist/case";

describe("snakeCase", () => {
    bench("visulima/string snakeCase (no cache)", () => {
        for (const string_ of TEST_STRINGS) {
            snakeCase(string_);
        }
    });

    bench("visulima/string snakeCase (with cache)", () => {
        for (const string_ of TEST_STRINGS) {
            snakeCase(string_, { cache: true });
        }
    });

    bench("lodash snakeCase", () => {
        for (const string_ of TEST_STRINGS) {
            lodashSnakeCase(string_);
        }
    });

    bench("case-anything snakeCase", () => {
        for (const string_ of TEST_STRINGS) {
            caseAnythingSnakeCase(string_);
        }
    });

    bench("scule snakeCase", () => {
        for (const string_ of TEST_STRINGS) {
            sculeSnakeCase(string_);
        }
    });

    bench("change-case snakeCase", () => {
        for (const string_ of TEST_STRINGS) {
            changeCaseSnake(string_);
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string snakeCase (no cache)", () => {
            for (const string_ of SPECIAL_STRINGS) {
                snakeCase(string_);
            }
        });

        bench("lodash snakeCase", () => {
            for (const string_ of SPECIAL_STRINGS) {
                lodashSnakeCase(string_);
            }
        });

        bench("case-anything snakeCase", () => {
            for (const string_ of SPECIAL_STRINGS) {
                caseAnythingSnakeCase(string_);
            }
        });

        bench("scule snakeCase", () => {
            for (const string_ of SPECIAL_STRINGS) {
                sculeSnakeCase(string_);
            }
        });

        bench("change-case snakeCase", () => {
            for (const string_ of SPECIAL_STRINGS) {
                changeCaseSnake(string_);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string snakeCase (no cache)", () => {
            for (const string_ of ACRONYM_STRINGS) {
                snakeCase(string_);
            }
        });

        bench("lodash snakeCase", () => {
            for (const string_ of ACRONYM_STRINGS) {
                lodashSnakeCase(string_);
            }
        });

        bench("case-anything snakeCase", () => {
            for (const string_ of ACRONYM_STRINGS) {
                caseAnythingSnakeCase(string_);
            }
        });

        bench("scule snakeCase", () => {
            for (const string_ of ACRONYM_STRINGS) {
                sculeSnakeCase(string_);
            }
        });

        bench("change-case snakeCase", () => {
            for (const string_ of ACRONYM_STRINGS) {
                changeCaseSnake(string_);
            }
        });
    });
});
