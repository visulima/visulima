import { bench, describe } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../__fixtures__/test-strings";
import { pascalSnakeCase } from "../dist/case";

describe("pascalSnakeCase", () => {
    bench("visulima/string pascalSnakeCase (no cache)", () => {
        for (const string_ of TEST_STRINGS) {
            pascalSnakeCase(string_);
        }
    });

    bench("visulima/string pascalSnakeCase (with cache)", () => {
        for (const string_ of TEST_STRINGS) {
            pascalSnakeCase(string_, { cache: true });
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string pascalSnakeCase (no cache)", () => {
            for (const string_ of SPECIAL_STRINGS) {
                pascalSnakeCase(string_);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string pascalSnakeCase (no cache)", () => {
            for (const string_ of ACRONYM_STRINGS) {
                pascalSnakeCase(string_);
            }
        });
    });
});
