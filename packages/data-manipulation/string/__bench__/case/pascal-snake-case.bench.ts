import { pascalSnakeCase } from "@visulima/string/case";
import { describe, test } from "vitest";

import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../../__fixtures__/test-strings";

describe("pascalSnakeCase", () => {
    test("visulima/string pascalSnakeCase (no cache)", async ({ bench }) => {
        await bench("visulima/string pascalSnakeCase (no cache)", () => {
            for (const stringValue of TEST_STRINGS) {
                pascalSnakeCase(stringValue);
            }
        }).run();
    });

    test("visulima/string pascalSnakeCase (with cache)", async ({ bench }) => {
        await bench("visulima/string pascalSnakeCase (with cache)", () => {
            for (const stringValue of TEST_STRINGS) {
                pascalSnakeCase(stringValue, { cache: true });
            }
        }).run();
    });

    describe("Special characters handling", () => {
        test("visulima/string pascalSnakeCase (no cache)", async ({ bench }) => {
            await bench("visulima/string pascalSnakeCase (no cache)", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    pascalSnakeCase(stringValue);
                }
            }).run();
        });
    });

    describe("Acronym handling", () => {
        test("visulima/string pascalSnakeCase (no cache)", async ({ bench }) => {
            await bench("visulima/string pascalSnakeCase (no cache)", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    pascalSnakeCase(stringValue);
                }
            }).run();
        });
    });
});
