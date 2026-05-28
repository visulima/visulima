import { describe, expect, it } from "vitest";

import {
    currencySymbolMap,
    getNameFromCurrency,
    getSafeNameFromCurrency,
    getSafeSymbolFromCurrency,
    getSymbolFromCurrency,
} from "../../src/data/currency-symbol";

describe("currencySymbolMap", () => {
    it("exposes entries with the documented shape", () => {
        expect.assertions(2);

        expect(Array.isArray(currencySymbolMap)).toBe(true);

        const entry = currencySymbolMap[0]!;

        expect(entry).toEqual(
            expect.objectContaining({
                code: expect.any(String),
                name: expect.any(String),
                number: expect.any(String),
                symbol: expect.any(String),
            }),
        );
    });

    it.each([
        { code: "USD", name: "US Dollar", symbol: "$" },
        { code: "EUR", name: "Euro", symbol: "€" },
        { code: "JPY", name: "Yen", symbol: "¥" },
    ])("contains the canonical $code entry", ({ code, name, symbol }) => {
        expect.assertions(1);

        const entry = currencySymbolMap.find((current) => current.code === code);

        expect(entry).toMatchObject({ code, name, symbol });
    });
});

describe(getSymbolFromCurrency, () => {
    it("returns the matching symbol for a known upper-case code", () => {
        expect.assertions(1);
        expect(getSymbolFromCurrency("USD")).toBe("$");
    });

    it("is case-insensitive on the lookup", () => {
        expect.assertions(2);
        expect(getSymbolFromCurrency("eur")).toBe("€");
        expect(getSymbolFromCurrency("jpy")).toBe("¥");
    });

    it("returns undefined for an unknown code", () => {
        expect.assertions(1);
        expect(getSymbolFromCurrency("XXX_NOT_A_CODE")).toBeUndefined();
    });
});

describe(getSafeSymbolFromCurrency, () => {
    it("returns the symbol when the code is known", () => {
        expect.assertions(1);
        expect(getSafeSymbolFromCurrency("USD")).toBe("$");
    });

    it("falls back to the input code when no symbol is registered", () => {
        expect.assertions(1);
        expect(getSafeSymbolFromCurrency("ZZZ")).toBe("ZZZ");
    });
});

describe(getNameFromCurrency, () => {
    it("returns the canonical name for known codes", () => {
        expect.assertions(2);
        expect(getNameFromCurrency("USD")).toBe("US Dollar");
        expect(getNameFromCurrency("eur")).toBe("Euro");
    });

    it("returns undefined for an unknown code", () => {
        expect.assertions(1);
        expect(getNameFromCurrency("XXX_NOT_A_CODE")).toBeUndefined();
    });
});

describe(getSafeNameFromCurrency, () => {
    it("returns the name when the code is known", () => {
        expect.assertions(1);
        expect(getSafeNameFromCurrency("JPY")).toBe("Yen");
    });

    it("falls back to the input code when no name is registered", () => {
        expect.assertions(1);
        expect(getSafeNameFromCurrency("ZZZ")).toBe("ZZZ");
    });
});
