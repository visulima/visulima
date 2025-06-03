import { pascalSnakeCase } from "@visulima/string/dist/case/case";
import { bench, describe } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../../__fixtures__/test-strings";

describe("pascalSnakeCase", () => {
    bench("visulima/string pascalSnakeCase (no cache)", () => {
        for (const stringValue of TEST_STRINGS) {
            pascalSnakeCase(stringValue);
        }
    });

    bench("visulima/string pascalSnakeCase (with cache)", () => {
        for (const stringValue of TEST_STRINGS) {
            pascalSnakeCase(stringValue, { cache: true });
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string pascalSnakeCase (no cache)", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                pascalSnakeCase(stringValue);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string pascalSnakeCase (no cache)", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                pascalSnakeCase(stringValue);
            }
        });
    });
});
