import type { LocaleOptions, PascalSnakeCase } from "../types";
import { noCase } from "./no-case";
import { upperFirst } from "./upper-first";

/**
 * Converts a string to Pascal_Snake_Case.
 * @example
 * ```typescript
 * pascalSnakeCase("foo bar") // => "Foo_Bar"
 * pascalSnakeCase("foo-bar") // => "Foo_Bar"
 * pascalSnakeCase("foo_bar") // => "Foo_Bar"
 * pascalSnakeCase("XMLHttpRequest") // => "Xml_Http_Request"
 * pascalSnakeCase("AJAXRequest") // => "Ajax_Request"
 * pascalSnakeCase("QueryXML123String") // => "Query_Xml_123_String"
 * ```
 */
export const pascalSnakeCase = <T extends string = string>(value: T, options: LocaleOptions = {}): PascalSnakeCase<T> => {
    const { locale } = options;
    const words = noCase(value, options).split(" ");
    
    return words.map((word) => upperFirst(word, { locale })).join("_") as PascalSnakeCase<T>;
};
