import { describe, expect, it } from "vitest";

import {
    getContinents,
    getCountriesInContinent,
    getCountriesInIntermediary,
    getCountriesInSubregion,
    getIntermediaryRegions,
    getRegionsForCountry,
    getSubregions,
} from "../src/regions";

describe("regions", () => {
    // Test data based on Wikipedia UN geoscheme
    describe(getRegionsForCountry, () => {
        it("should get region for US", () => {
            expect.hasAssertions();

            const region = getRegionsForCountry("US");

            expect(region).toStrictEqual({
                continent: "Americas",
                intermediary: "North America",
                subregion: "Northern America",
            });
        });

        it("should get region for Algeria (Northern Africa)", () => {
            expect.hasAssertions();

            const region = getRegionsForCountry("DZ");

            expect(region).toStrictEqual({
                continent: "Africa",
                subregion: "Northern Africa",
            });
        });

        it("should get region for Kenya (Eastern Africa with intermediary)", () => {
            expect.hasAssertions();

            const region = getRegionsForCountry("KE");

            expect(region).toStrictEqual({
                continent: "Africa",
                intermediary: "Sub-Saharan Africa",
                subregion: "Eastern Africa",
            });
        });

        it("should get region for China", () => {
            expect.hasAssertions();

            const region = getRegionsForCountry("CN");

            expect(region).toStrictEqual({
                continent: "Asia",
                subregion: "Eastern Asia",
            });
        });

        it("should get region for Germany", () => {
            expect.hasAssertions();

            const region = getRegionsForCountry("DE");

            expect(region).toStrictEqual({
                continent: "Europe",
                subregion: "Western Europe",
            });
        });

        it("should get region for Australia", () => {
            expect.hasAssertions();

            const region = getRegionsForCountry("AU");

            expect(region).toStrictEqual({
                continent: "Oceania",
                subregion: "Australia and New Zealand",
            });
        });

        it("should return undefined for invalid country code", () => {
            expect.hasAssertions();
            expect(getRegionsForCountry("XX")).toBeUndefined();
        });

        it("should handle case-insensitive country codes", () => {
            expect.hasAssertions();
            expect(getRegionsForCountry("us")).toBeDefined();
            expect(getRegionsForCountry("US")).toBeDefined();
        });
    });

    describe(getCountriesInContinent, () => {
        it("should get countries in Africa", () => {
            expect.hasAssertions();

            const countries = getCountriesInContinent("Africa");

            expect(countries.length).toBeGreaterThan(50);
            expect(countries).toContain("DZ");
            expect(countries).toContain("KE");
            expect(countries).toContain("ZA");
        });

        it("should get countries in Americas", () => {
            expect.hasAssertions();

            const countries = getCountriesInContinent("Americas");

            expect(countries.length).toBeGreaterThan(30);
            expect(countries).toContain("US");
            expect(countries).toContain("CA");
            expect(countries).toContain("BR");
            expect(countries).toContain("MX");
        });

        it("should get countries in Asia", () => {
            expect.hasAssertions();

            const countries = getCountriesInContinent("Asia");

            expect(countries.length).toBeGreaterThan(40);
            expect(countries).toContain("CN");
            expect(countries).toContain("IN");
            expect(countries).toContain("JP");
        });

        it("should get countries in Europe", () => {
            expect.hasAssertions();

            const countries = getCountriesInContinent("Europe");

            expect(countries.length).toBeGreaterThan(40);
            expect(countries).toContain("DE");
            expect(countries).toContain("FR");
            expect(countries).toContain("GB");
        });

        it("should get countries in Oceania", () => {
            expect.hasAssertions();

            const countries = getCountriesInContinent("Oceania");

            expect(countries.length).toBeGreaterThan(10);
            expect(countries).toContain("AU");
            expect(countries).toContain("NZ");
            expect(countries).toContain("FJ");
        });

        it("should get countries in Antarctica", () => {
            expect.hasAssertions();

            const countries = getCountriesInContinent("Antarctica");

            expect(countries).toContain("AQ");
        });

        it("should return empty array for invalid continent", () => {
            expect.hasAssertions();
            expect(getCountriesInContinent("Invalid")).toStrictEqual([]);
        });
    });

    describe(getCountriesInSubregion, () => {
        it("should get countries in Northern America", () => {
            expect.hasAssertions();

            const countries = getCountriesInSubregion("Northern America");

            expect(countries).toContain("US");
            expect(countries).toContain("CA");
            expect(countries.length).toBeGreaterThan(0);
        });

        it("should get countries in Western Europe", () => {
            expect.hasAssertions();

            const countries = getCountriesInSubregion("Western Europe");

            expect(countries).toContain("DE");
            expect(countries).toContain("FR");
            expect(countries).toContain("CH");
            expect(countries.length).toBeGreaterThan(0);
        });

        it("should get countries in Eastern Asia", () => {
            expect.hasAssertions();

            const countries = getCountriesInSubregion("Eastern Asia");

            expect(countries).toContain("CN");
            expect(countries).toContain("JP");
            expect(countries).toContain("KR");
            expect(countries.length).toBeGreaterThan(0);
        });

        it("should get countries in Northern Africa", () => {
            expect.hasAssertions();

            const countries = getCountriesInSubregion("Northern Africa");

            expect(countries).toContain("DZ");
            expect(countries).toContain("EG");
            expect(countries).toContain("MA");
            expect(countries.length).toBeGreaterThan(0);
        });

        it("should return empty array for invalid subregion", () => {
            expect.hasAssertions();
            expect(getCountriesInSubregion("Invalid Subregion")).toStrictEqual([]);
        });
    });

    describe(getCountriesInIntermediary, () => {
        it("should get countries in Sub-Saharan Africa", () => {
            expect.hasAssertions();

            const countries = getCountriesInIntermediary("Sub-Saharan Africa");

            expect(countries.length).toBeGreaterThan(40);
            expect(countries).toContain("KE");
            expect(countries).toContain("ZA");
            expect(countries).toContain("NG");
        });

        it("should get countries in Latin America and the Caribbean", () => {
            expect.hasAssertions();

            const countries = getCountriesInIntermediary("Latin America and the Caribbean");

            expect(countries.length).toBeGreaterThan(30);
            expect(countries).toContain("BR");
            expect(countries).toContain("MX");
            expect(countries).toContain("AR");
        });

        it("should get countries in North America", () => {
            expect.hasAssertions();

            const countries = getCountriesInIntermediary("North America");

            expect(countries).toContain("US");
            expect(countries).toContain("CA");
            expect(countries.length).toBeGreaterThan(0);
        });

        it("should return empty array for invalid intermediary", () => {
            expect.hasAssertions();
            expect(getCountriesInIntermediary("Invalid")).toStrictEqual([]);
        });
    });

    describe(getContinents, () => {
        it("should return all continents", () => {
            expect.hasAssertions();

            const continents = getContinents();

            expect(continents).toContain("Africa");
            expect(continents).toContain("Americas");
            expect(continents).toContain("Asia");
            expect(continents).toContain("Europe");
            expect(continents).toContain("Oceania");
            expect(continents).toContain("Antarctica");
            expect(continents).toHaveLength(6);
        });

        it("should return sorted continents", () => {
            expect.hasAssertions();

            const continents = getContinents();

            expect(continents).toStrictEqual(continents.toSorted((a, b) => a.localeCompare(b)));
        });
    });

    describe(getSubregions, () => {
        it("should return all subregions", () => {
            expect.hasAssertions();

            const subregions = getSubregions();

            expect(subregions.length).toBeGreaterThan(20);
            expect(subregions).toContain("Northern America");
            expect(subregions).toContain("Western Europe");
            expect(subregions).toContain("Eastern Asia");
        });

        it("should filter subregions by continent", () => {
            expect.hasAssertions();

            const subregions = getSubregions("Europe");

            expect(subregions).toContain("Western Europe");
            expect(subregions).toContain("Eastern Europe");
            expect(subregions).toContain("Northern Europe");
            expect(subregions).toContain("Southern Europe");
            expect(subregions).not.toContain("Northern America");
        });

        it("should return sorted subregions", () => {
            expect.hasAssertions();

            const subregions = getSubregions();

            expect(subregions).toStrictEqual(subregions.toSorted((a, b) => a.localeCompare(b)));
        });
    });

    describe(getIntermediaryRegions, () => {
        it("should return all intermediary regions", () => {
            expect.hasAssertions();

            const intermediaries = getIntermediaryRegions();

            expect(intermediaries.length).toBeGreaterThan(0);
            expect(intermediaries).toContain("Sub-Saharan Africa");
            expect(intermediaries).toContain("Latin America and the Caribbean");
            expect(intermediaries).toContain("North America");
        });

        it("should filter intermediary regions by continent", () => {
            expect.hasAssertions();

            const intermediaries = getIntermediaryRegions("Africa");

            expect(intermediaries).toContain("Sub-Saharan Africa");
            expect(intermediaries).not.toContain("Latin America and the Caribbean");
        });

        it("should return sorted intermediary regions", () => {
            expect.hasAssertions();

            const intermediaries = getIntermediaryRegions();

            expect(intermediaries).toStrictEqual(intermediaries.toSorted((a, b) => a.localeCompare(b)));
        });
    });

    describe("wikipedia validation", () => {
        // Validate against specific examples from Wikipedia
        it("should match Wikipedia examples for Northern Africa", () => {
            expect.hasAssertions();

            const countries = getCountriesInSubregion("Northern Africa");
            const expected = ["DZ", "EG", "LY", "MA", "SD", "TN", "EH"];

            expected.forEach((code) => {
                expect(countries).toContain(code);
            });
        });

        it("should match Wikipedia examples for Northern America", () => {
            expect.hasAssertions();

            const countries = getCountriesInSubregion("Northern America");
            const expected = ["BM", "CA", "GL", "PM", "US"];

            expected.forEach((code) => {
                expect(countries).toContain(code);
            });
        });

        it("should match Wikipedia examples for Eastern Asia", () => {
            expect.hasAssertions();

            const countries = getCountriesInSubregion("Eastern Asia");
            const expected = ["CN", "HK", "MO", "KP", "JP", "MN", "KR"];

            expected.forEach((code) => {
                expect(countries).toContain(code);
            });
        });

        it("should match Wikipedia examples for Western Europe", () => {
            expect.hasAssertions();

            const countries = getCountriesInSubregion("Western Europe");
            const expected = ["AT", "BE", "FR", "DE", "LI", "LU", "MC", "NL", "CH"];

            expected.forEach((code) => {
                expect(countries).toContain(code);
            });
        });
    });
});
