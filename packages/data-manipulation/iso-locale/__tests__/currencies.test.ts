import { describe, expect, it } from "vitest";

import {
    all,
    getByCode,
    getByCountry,
    getByNumber,
    getCountriesByCurrency,
    getCurrencyByName,
    getName,
    getSymbol,
    isValid,
    searchCurrencies,
} from "../src/currencies";

describe("currencies", () => {
    it("should get currency by code", () => {
        expect.hasAssertions();

        const currency = getByCode("USD");

        expect(currency).toBeDefined();
        expect(currency?.name).toBe("United States dollar");
        expect(currency?.code).toBe("USD");
        expect(currency?.number).toBe("840");
        expect(currency?.decimals).toBe(2);
    });

    it("should get currency by number", () => {
        expect.hasAssertions();

        const currency = getByNumber("840");

        expect(currency).toBeDefined();
        expect(currency?.code).toBe("USD");
    });

    it("should get currency by numeric value", () => {
        expect.assertions(2);

        const currency = getByNumber(840);

        expect(currency).toBeDefined();
        expect(currency?.code).toBe("USD");
    });

    it("should fall back to the code when the symbol is unknown", () => {
        expect.assertions(1);
        expect(getSymbol("zzz")).toBe("ZZZ");
    });

    it("should get currencies by country", () => {
        expect.hasAssertions();

        const currencies = getByCountry("US");

        expect(currencies.length).toBeGreaterThan(0);
        expect(currencies[0]?.code).toBe("USD");
    });

    it("should get countries by currency", () => {
        expect.hasAssertions();

        const countries = getCountriesByCurrency("EUR");

        expect(countries.length).toBeGreaterThan(0);
        expect(countries).toContain("FR");
        expect(countries).toContain("DE");
    });

    it("should get currency symbol", () => {
        expect.hasAssertions();
        expect(getSymbol("USD")).toBe("$");
        expect(getSymbol("EUR")).toBe("€");
        expect(getSymbol("GBP")).toBe("£");
    });

    it("should get currency name", () => {
        expect.hasAssertions();
        expect(getName("USD")).toBe("United States dollar");
        expect(getName("EUR")).toBe("Euro");
    });

    it("should validate currency codes", () => {
        expect.hasAssertions();
        expect(isValid("USD")).toBe(true);
        expect(isValid("840")).toBe(true);
        expect(isValid("INVALID")).toBe(false);
        expect(isValid("000")).toBe(false);
    });

    it("should handle case-insensitive codes", () => {
        expect.hasAssertions();
        expect(getByCode("usd")).toBeDefined();
        expect(getByCode("Usd")).toBeDefined();
    });

    it("should have all currencies array", () => {
        expect.hasAssertions();
        expect(all.length).toBeGreaterThan(100);
        expect(all[0]).toHaveProperty("code");
        expect(all[0]).toHaveProperty("name");
        expect(all[0]).toHaveProperty("number");
    });

    it("should get currency by exact name", () => {
        expect.hasAssertions();

        const currency = getCurrencyByName("United States dollar");

        expect(currency).toBeDefined();
        expect(currency?.code).toBe("USD");
        expect(currency?.name).toBe("United States dollar");

        const currency2 = getCurrencyByName("united states dollar");

        expect(currency2?.code).toBe("USD");

        const currency3 = getCurrencyByName("UNITED STATES DOLLAR");

        expect(currency3?.code).toBe("USD");
    });

    it("should return undefined for non-existent currency name", () => {
        expect.hasAssertions();
        expect(getCurrencyByName("NonExistentCurrency")).toBeUndefined();
        expect(getCurrencyByName("")).toBeUndefined();
    });

    it("should search currencies by partial name", () => {
        expect.hasAssertions();

        const results = searchCurrencies("dollar");

        expect(results.length).toBeGreaterThan(0);
        expect(results.some((c) => c.code === "USD")).toBe(true);
        expect(results.some((c) => c.code === "CAD")).toBe(true);

        const results2 = searchCurrencies("Dollar");

        expect(results2.length).toBeGreaterThan(0);
    });

    it("should return empty array for empty search query", () => {
        expect.hasAssertions();
        expect(searchCurrencies("")).toStrictEqual([]);
        expect(searchCurrencies("   ")).toStrictEqual([]);
    });

    it("should handle case-insensitive currency search", () => {
        expect.hasAssertions();

        const results = searchCurrencies("EURO");

        expect(results.some((c) => c.code === "EUR")).toBe(true);

        const results2 = searchCurrencies("euro");

        expect(results2.some((c) => c.code === "EUR")).toBe(true);
    });
});
