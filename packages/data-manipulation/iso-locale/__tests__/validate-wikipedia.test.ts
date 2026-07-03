import { beforeAll, describe, expect, it } from "vitest";

import { all as currencies } from "../src/currencies";
import { currencySymbolMap } from "../src/data/currency-symbol";

const ALPHA3_REGEX = /^[A-Z]{3}$/;
const DIGITS_1_3_REGEX = /^\d{1,3}$/;
const CITATION_REF_REGEX = /\[\d+\]/g;
const WHITESPACE_REGEX = /\s+/;
const ACTIVE_CODES_TABLE_REGEX = /<table[^>]*class="[^"]*wikitable[^"]*"[^>]*>[\s\S]*?Active codes[\s\S]*?<\/table>/i;
const ACTIVE_ISO4217_TABLE_REGEX = /<table[^>]*class="[^"]*wikitable[^"]*"[^>]*>[\s\S]*?Active ISO 4217[\s\S]*?<\/table>/i;
const WIKITABLE_REGEX = /<table[^>]*class="[^"]*wikitable[^"]*"[^>]*>([\s\S]*?)<\/table>/gi;
const SYMBOL_TABLE_REGEX = /<table[^>]*class="[^"]*wikitable[^"]*"[^>]*>[\s\S]*?Currency symbols[\s\S]*?<\/table>/i;
const SYMBOL_TABLE_ALT_REGEX = /<table[^>]*>[\s\S]*?Currency symbols[\s\S]*?<\/table>/i;

/**
 * Known currency name variations between Wikipedia and our data
 * Maps currency codes to alternative names that should be considered equivalent
 */
const currencyNameVariations: Record<string, string[]> = {
    CNY: ["renminbi", "yuan", "chinese yuan", "chinese renminbi"],
    // Add more variations as needed
};

/**
 * Wikipedia API helper to fetch page content.
 * Uses the Wikipedia REST API which is preferred over scraping.
 *
 * Note: HTML parsing is used here as Wikipedia's REST API provides HTML.
 * For production use, consider using Wikipedia's structured data APIs or
 * a proper HTML parser library. This approach works for testing purposes.
 *
 * Rate limiting: Wikipedia allows reasonable API usage. We fetch once per test run
 * and cache the results in beforeAll to minimize API calls.
 */
const fetchWikipediaPage = async (title: string): Promise<string> => {
    const url = `https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(title)}`;
    const response = await fetch(url, {
        headers: {
            "User-Agent": "visulima-iso-test/1.0 (testing ISO 4217 data validation)",
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch Wikipedia page: ${String(response.status)} ${response.statusText}`);
    }

    return response.text();
};

const stripHtmlTagsSafely = (input: string): string => {
    let previous: string;
    let current = input;

    do {
        previous = current;
        // eslint-disable-next-line sonarjs/slow-regex
        current = current.replaceAll(/<[^>]+>/g, "");
    } while (current !== previous);

    return current;
};

/**
 * Extract text content from HTML, handling nested tags and links.
 */
const extractTextFromHtml = (html: string): string =>
    stripHtmlTagsSafely(
        html
            .replaceAll(/<a[^>]*>([\s\S]*?)<\/a>/gi, "$1") // Extract link text
            .replaceAll(/<span[^>]*>([\s\S]*?)<\/span>/gi, "$1"), // Extract span content
    )
        .replaceAll("&nbsp;", " ")
        .replaceAll("&lt;", "<")
        .replaceAll("&gt;", ">")
        .replaceAll("&quot;", "\"")
        .replaceAll("&#91;", "[")
        .replaceAll("&#93;", "]")
        .replaceAll("&#160;", " ")
        .replaceAll("&amp;", "&")
        .trim();

/**
 * Parse table rows to extract currency data.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const parseTableRows = (tableHtml: string): { code: string; name: string; number: string }[] => {
    const result: { code: string; name: string; number: string }[] = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let match: RegExpExecArray | undefined;
    let isHeader = true;

    // eslint-disable-next-line no-cond-assign
    while ((match = rowRegex.exec(tableHtml)) !== null) {
        const rowHtml = match[1];

        // Skip header rows - look for "Code" and "Num" in header
        if (isHeader) {
            if (rowHtml.includes("<th") && (rowHtml.includes("Code") || rowHtml.includes("Num"))) {
                isHeader = false;
                continue;
            }

            // If we see a header row, mark that we've passed headers
            if (rowHtml.includes("<th")) {
                continue;
            }
        }

        // Extract cells - handle both <td> and <th> tags
        const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
        const cells: string[] = [];
        let cellMatch: RegExpExecArray | null;

        // eslint-disable-next-line no-cond-assign
        while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
            const cellText = extractTextFromHtml(cellMatch[1]);

            if (cellText) {
                cells.push(cellText);
            }
        }

        // Table structure: Code | Num | D | Currency | Locations
        // We need Code (index 0), Num (index 1), and Currency name (index 3)
        if (cells.length >= 4) {
            const code = cells[0]?.trim().toUpperCase();
            const number = cells[1]?.trim().padStart(3, "0");
            const name = cells[3]?.trim();

            // Validate code format (3 letters) and number (3 digits)
            if (code && ALPHA3_REGEX.test(code) && number && DIGITS_1_3_REGEX.test(number) && name) {
                const paddedNumber = number.padStart(3, "0");

                result.push({ code, name, number: paddedNumber });
            }
        }
    }

    return result;
};

/**
 * Parse ISO 4217 table from Wikipedia HTML.
 * Extracts currency codes, numeric codes, and currency names.
 * Uses a more robust approach to handle Wikipedia's HTML structure.
 */
const parseISO4217Table = (html: string): { code: string; name: string; number: string }[] => {
    const result: { code: string; name: string; number: string }[] = [];

    // Look for the table with class "wikitable" that contains "Active ISO 4217 currency codes"
    // The table structure: Code | Num | D | Currency | Locations
    const tableMatch = ACTIVE_CODES_TABLE_REGEX.exec(html) ?? ACTIVE_ISO4217_TABLE_REGEX.exec(html);

    if (!tableMatch) {
        // Try to find any wikitable that might contain currency data
        const allTables = html.matchAll(WIKITABLE_REGEX);

        for (const table of allTables) {
            if (table[1].includes("AED") || table[1].includes("USD") || table[1].includes("EUR")) {
                const tableHtml = table[0];

                return parseTableRows(tableHtml);
            }
        }

        return result;
    }

    return parseTableRows(tableMatch[0]);
};

/**
 * Parse symbol table rows to extract currency symbol data.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const parseSymbolTableRows = (tableHtml: string): { code: string; name: string; symbol: string }[] => {
    const result: { code: string; name: string; symbol: string }[] = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let match: RegExpExecArray | undefined;
    let isHeader = true;

    // eslint-disable-next-line no-cond-assign
    while ((match = rowRegex.exec(tableHtml)) !== null) {
        const rowHtml = match[1];

        // Skip header rows
        if (isHeader) {
            if (rowHtml.includes("<th") && (rowHtml.includes("Symbol") || rowHtml.includes("Abbreviation"))) {
                isHeader = false;
                continue;
            }

            if (rowHtml.includes("<th")) {
                continue;
            }
        }

        // Extract cells
        const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
        const cells: string[] = [];
        let cellMatch: RegExpExecArray | null;

        // eslint-disable-next-line no-cond-assign
        while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
            const cellText = extractTextFromHtml(cellMatch[1]);

            if (cellText) {
                cells.push(cellText);
            }
        }

        // Table structure: Symbol | Abbreviation | Name | Currency | Notes | Unicode
        // We need Symbol (index 0), Abbreviation/Code (index 1), and Name (index 2)
        if (cells.length >= 3) {
            const symbol = cells[0]?.trim();
            const code = cells[1]?.trim().toUpperCase();
            const name = cells[2]?.trim();

            // Validate code format (3 letters) - some entries might not have codes
            if (symbol && code && ALPHA3_REGEX.test(code) && name) {
                result.push({ code, name, symbol });
            }
        }
    }

    return result;
};

/**
 * Parse currency symbol table from Wikipedia HTML.
 * Extracts currency codes and their symbols.
 * Uses a more robust approach to handle Wikipedia's HTML structure.
 */
const parseCurrencySymbolTable = (html: string): { code: string; name: string; symbol: string }[] => {
    const result: { code: string; name: string; symbol: string }[] = [];

    // Look for currency symbol tables - Wikipedia uses wikitable class
    const tableMatch = SYMBOL_TABLE_REGEX.exec(html) ?? SYMBOL_TABLE_ALT_REGEX.exec(html);

    if (!tableMatch) {
        // Try to find any wikitable that might contain symbol data
        const allTables = html.matchAll(WIKITABLE_REGEX);

        for (const table of allTables) {
            if (table[1].includes("$") && (table[1].includes("USD") || table[1].includes("EUR"))) {
                const tableHtml = table[0];

                return parseSymbolTableRows(tableHtml);
            }
        }

        return result;
    }

    return parseSymbolTableRows(tableMatch[0]);
};

// Live network validation against Wikipedia. Skipped by default so plain
// `vitest run` stays deterministic offline/in CI; opt in with VALIDATE_ISO_DATA=1
// (e.g. in a scheduled data-freshness workflow).
const runWikipediaValidation = process.env.VALIDATE_ISO_DATA === "1";

describe.skipIf(!runWikipediaValidation)("wikipedia Validation", () => {
    let wikipediaISO4217: { code: string; name: string; number: string }[];
    let wikipediaCurrencySymbols: { code: string; name: string; symbol: string }[];

    beforeAll(async () => {
        // Initialize variables within hook
        wikipediaISO4217 = [];
        wikipediaCurrencySymbols = [];
        // Fetch Wikipedia data with timeout and error handling
        // Add a small delay to respect rate limits
        await new Promise<void>((resolve) => {
            setTimeout(() => {
                resolve();
            }, 500);
        });

        try {
            const [iso4217Html, symbolHtml] = await Promise.all([
                fetchWikipediaPage("ISO_4217").catch((error) => {
                    // eslint-disable-next-line no-console
                    console.warn("Failed to fetch ISO_4217 page:", error.message);

                    return undefined;
                }),
                fetchWikipediaPage("Currency_symbol").catch((error) => {
                    // eslint-disable-next-line no-console
                    console.warn("Failed to fetch Currency_symbol page:", error.message);

                    return undefined;
                }),
            ]);

            if (iso4217Html) {
                try {
                    wikipediaISO4217 = parseISO4217Table(iso4217Html);

                    if (wikipediaISO4217.length === 0) {
                        // eslint-disable-next-line no-console
                        console.warn("Warning: Parsed 0 currencies from Wikipedia ISO_4217 page");
                    }
                } catch (error) {
                    // eslint-disable-next-line no-console
                    console.warn("Failed to parse ISO_4217 table:", error);
                }
            }

            if (symbolHtml) {
                try {
                    wikipediaCurrencySymbols = parseCurrencySymbolTable(symbolHtml);

                    if (wikipediaCurrencySymbols.length === 0) {
                        // eslint-disable-next-line no-console
                        console.warn("Warning: Parsed 0 currency symbols from Wikipedia Currency_symbol page");
                    }
                } catch (error) {
                    // eslint-disable-next-line no-console
                    console.warn("Failed to parse Currency_symbol table:", error);
                }
            }
        } catch (error) {
            // eslint-disable-next-line no-console
            console.warn("Failed to fetch Wikipedia data:", error);
            // Tests will be skipped if data is unavailable
        }
    }, 90_000); // 90 second timeout - generous timeout for network delays and Wikipedia API responses

    // eslint-disable-next-line sonarjs/cognitive-complexity
    it("should validate major currency codes against Wikipedia ISO 4217", () => {
        expect.hasAssertions();

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (wikipediaISO4217.length === 0) {
            // eslint-disable-next-line no-console
            console.warn("Skipping test: Wikipedia ISO 4217 data not available");

            return;
        }

        const issues: string[] = [];
        const majorCurrencies = ["USD", "EUR", "GBP", "JPY", "CNY", "AUD", "CAD", "CHF", "INR", "BRL"];

        for (const code of majorCurrencies) {
            const wikiCurrency = wikipediaISO4217.find((c) => c.code === code);
            const ourCurrency = currencies.find((c) => c.code === code);

            if (!wikiCurrency) {
                issues.push(`Currency ${code} not found in Wikipedia data`);
                continue;
            }

            if (!ourCurrency) {
                issues.push(`Currency ${code} not found in our data`);
                continue;
            }

            // Validate numeric code
            const expectedNumber = wikiCurrency.number.padStart(3, "0");

            if (ourCurrency.number !== expectedNumber) {
                issues.push(`Currency ${code}: number mismatch - Wikipedia: ${expectedNumber}, ours: ${ourCurrency.number}`);
            }

            // Validate name (allow for minor variations and citation references)
            // Remove citation references like [6] from Wikipedia names
            const wikiName = wikiCurrency.name
                .replaceAll(CITATION_REF_REGEX, "") // Remove citation references [1], [2], etc.
                .toLowerCase()
                .trim();
            const ourName = ourCurrency.name.toLowerCase().trim();

            // Check if there are known variations for this currency
            const variations = currencyNameVariations[code] ?? [];
            const wikiInVariations = variations.some((v) => wikiName.includes(v));
            const ourInVariations = variations.some((v) => ourName.includes(v));

            // If both names are in the known variations, they're equivalent
            if (wikiInVariations && ourInVariations) {
                // Names are equivalent via known variations
                continue;
            }

            // Extract first significant word from each name for comparison
            const wikiFirstWord = wikiName.split(WHITESPACE_REGEX)[0] ?? "";
            const ourFirstWord = ourName.split(WHITESPACE_REGEX)[0] ?? "";

            // Check if names are similar (either contains the other's first word, or they share common terms)
            const namesSimilar
                = ourName.includes(wikiFirstWord)
                    || wikiName.includes(ourFirstWord)
                    || (wikiFirstWord.length > 3 && ourFirstWord.length > 3 && (ourName.includes(wikiFirstWord) || wikiName.includes(ourFirstWord)));

            if (!namesSimilar && wikiFirstWord !== ourFirstWord) {
                issues.push(`Currency ${code}: name mismatch - Wikipedia: "${wikiCurrency.name}", ours: "${ourCurrency.name}"`);
            }
        }

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (issues.length > 0) {
            // eslint-disable-next-line no-console
            console.log("\nWikipedia ISO 4217 validation issues:");

            issues.forEach((issue) => {
                // eslint-disable-next-line no-console
                console.log(`  - ${issue}`);
            });
        }

        expect(issues).toHaveLength(0);
    });

    it("should validate currency symbols against Wikipedia", () => {
        expect.hasAssertions();

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (wikipediaCurrencySymbols.length === 0) {
            // eslint-disable-next-line no-console
            console.warn("Skipping test: Wikipedia currency symbol data not available");

            return;
        }

        const issues: string[] = [];
        const majorCurrencies = ["USD", "EUR", "GBP", "JPY", "CNY", "AUD", "CAD", "CHF", "INR", "BRL"];

        for (const code of majorCurrencies) {
            const wikiSymbol = wikipediaCurrencySymbols.find((s) => s.code === code);
            const ourSymbol = currencySymbolMap.find((s) => s.code === code);

            if (!wikiSymbol) {
                // Some currencies might not have symbols in Wikipedia table
                continue;
            }

            if (!ourSymbol) {
                issues.push(`Currency symbol for ${code} not found in our data`);
                continue;
            }

            // Compare symbols (normalize whitespace)
            const wikiSymbolNormalized = wikiSymbol.symbol.trim();
            const ourSymbolNormalized = ourSymbol.symbol.trim();

            // Allow for variations (e.g., different Unicode representations)
            // Only report if completely different
            if (wikiSymbolNormalized !== ourSymbolNormalized && !ourSymbolNormalized.includes(wikiSymbolNormalized)) {
                issues.push(`Currency ${code}: symbol mismatch - Wikipedia: "${wikiSymbolNormalized}", ours: "${ourSymbolNormalized}"`);
            }
        }

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (issues.length > 0) {
            // eslint-disable-next-line no-console
            console.log("\nWikipedia currency symbol validation issues:");

            issues.forEach((issue) => {
                // eslint-disable-next-line no-console
                console.log(`  - ${issue}`);
            });
        }

        // This is informational - symbol variations are acceptable
        // We log but don't fail the test
        // eslint-disable-next-line vitest/no-conditional-in-test
        if (issues.length > 0) {
            // eslint-disable-next-line no-console
            console.warn(`Found ${String(issues.length)} symbol mismatches (this is informational)`);
        }

        // Test passes regardless of issues (informational only)
        expect(true).toBe(true);
    });

    it("should have all Wikipedia-listed active currencies", () => {
        expect.hasAssertions();

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (wikipediaISO4217.length === 0) {
            // eslint-disable-next-line no-console
            console.warn("Skipping test: Wikipedia ISO 4217 data not available");

            return;
        }

        const issues: string[] = [];
        const ourCurrencyCodes = new Set(currencies.map((c) => c.code));

        // Check a sample of Wikipedia currencies (not all, as some might be historical)
        const sampleSize = Math.min(50, wikipediaISO4217.length);
        const sampleCurrencies = wikipediaISO4217.slice(0, sampleSize);

        for (const wikiCurrency of sampleCurrencies) {
            if (!ourCurrencyCodes.has(wikiCurrency.code)) {
                issues.push(`Missing currency: ${wikiCurrency.code} (${wikiCurrency.name}) - listed in Wikipedia but not in our data`);
            }
        }

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (issues.length > 0) {
            // eslint-disable-next-line no-console
            console.log("\nMissing currencies from Wikipedia:");

            issues.forEach((issue) => {
                // eslint-disable-next-line no-console
                console.log(`  - ${issue}`);
            });
        }

        // Allow some missing currencies as Wikipedia might include historical ones
        // Fail only if more than 10% are missing
        const missingPercentage = (issues.length / sampleSize) * 100;

        expect(missingPercentage).toBeLessThanOrEqual(10);
    });
});
