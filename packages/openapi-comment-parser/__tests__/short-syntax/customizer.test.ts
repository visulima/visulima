import { describe, expect, it } from "vitest";

import customizer from "../../src/short-syntax/customizer";

describe('customizer', () => {
    it('should concatenate sourceValue to objectValue when objectValue is an array', () => {
        const objectValue = [1, 2, 3];
        const sourceValue = [4, 5, 6];
        const expectedResult = [1, 2, 3, 4, 5, 6];

        const result = customizer(objectValue, sourceValue);

        expect(result).toEqual(expectedResult);
    });

    it('should return undefined when objectValue is not an array', () => {
        const objectValue = 'not an array';
        const sourceValue = [1, 2, 3];

        const result = customizer(objectValue, sourceValue);

        expect(result).toBeUndefined();
    });

    it('should return undefined when objectValue is null', () => {
        const objectValue = null;
        const sourceValue = [1, 2, 3];

        const result = customizer(objectValue, sourceValue);

        expect(result).toBeUndefined();
    });

    it('should return undefined when objectValue is undefined', () => {
        const objectValue = undefined;
        const sourceValue = [1, 2, 3];

        const result = customizer(objectValue, sourceValue);

        expect(result).toBeUndefined();
    });
});
