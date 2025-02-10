import { bench, describe } from "vitest";
import { pascalSnakeCase } from "../dist/case";
import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "./test-strings";

describe("pascalSnakeCase", () => {
    bench("visulima/string pascalSnakeCase (no cache)", () => {
        for (const str of TEST_STRINGS) {
            pascalSnakeCase(str);
        }
    });

    bench("visulima/string pascalSnakeCase (with cache)", () => {
        for (const str of TEST_STRINGS) {
            pascalSnakeCase(str);
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string pascalSnakeCase (no cache)", () => {
            for (const str of SPECIAL_STRINGS) {
                pascalSnakeCase(str);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string pascalSnakeCase (no cache)", () => {
            for (const str of ACRONYM_STRINGS) {
                pascalSnakeCase(str);
            }
        });
    });
});
