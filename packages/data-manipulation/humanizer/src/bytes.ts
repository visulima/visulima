import type { FormatBytesOptions, ParseByteOptions } from "./types";

// The value group accepts every grouping separator locales actually use between
// digit runs: "." "," apostrophe variants and any Unicode space separator
// (\p{Zs} covers the regular space plus the U+00A0/U+202F no-break spaces that
// fr-FR/sv-SE emit). parseLocalizedNumber strips them back out per locale.
// eslint-disable-next-line sonarjs/unused-named-groups -- named groups are used via match.groups
const PARSE_BYTES_REGEX = /^(?<value>-?\d+(?:[\p{Zs}'’.,]\d+)*)\p{Zs}*(?<type>[a-z]+)?$/iu;

const BYTE_SIZES = {
    iec: [
        {
            long: "Bytes",
            short: "B",
        },
        {
            long: "Kibibytes",
            short: "KiB",
        },
        {
            long: "Mebibytes",
            short: "MiB",
        },
        {
            long: "Gibibytes",
            short: "GiB",
        },
        {
            long: "Tebibytes",
            short: "TiB",
        },
        {
            long: "Pebibytes",
            short: "PiB",
        },
        {
            long: "Exbibytes",
            short: "EiB",
        },
        {
            long: "Zebibytes",
            short: "ZiB",
        },
        {
            long: "Yobibytes",
            short: "YiB",
        },
    ],
    iec_octet: [
        {
            long: "Octets",
            short: "o",
        },
        {
            long: "Kibioctets",
            short: "Kio",
        },
        {
            long: "Mebioctets",
            short: "Mio",
        },
        {
            long: "Gibioctets",
            short: "Gio",
        },
        {
            long: "Tebioctets",
            short: "Tio",
        },
        {
            long: "Pebioctets",
            short: "Pio",
        },
        {
            long: "Exbioctets",
            short: "Eio",
        },
        {
            long: "Zebioctets",
            short: "Zio",
        },
        {
            long: "Yobioctets",
            short: "Yio",
        },
    ],
    metric: [
        {
            long: "Bytes",
            short: "Bytes",
        },
        {
            long: "Kilobytes",
            short: "KB",
        },
        {
            long: "Megabytes",
            short: "MB",
        },
        {
            long: "Gigabytes",
            short: "GB",
        },
        {
            long: "Terabytes",
            short: "TB",
        },
        {
            long: "Petabytes",
            short: "PB",
        },
        {
            long: "Exabytes",
            short: "EB",
        },
        {
            long: "Zettabytes",
            short: "ZB",
        },
        {
            long: "Yottabytes",
            short: "YB",
        },
    ],
    metric_octet: [
        {
            long: "Octets",
            short: "o",
        },
        {
            long: "Kilo-octets",
            short: "ko",
        },
        {
            long: "Mega-octets",
            short: "Mo",
        },
        {
            long: "Giga-octets",
            short: "Go",
        },
        {
            long: "Tera-octets",
            short: "To",
        },
        {
            long: "Peta-octets",
            short: "Po",
        },
        {
            long: "Exa-octets",
            short: "Eo",
        },
        {
            long: "Zetta-octets",
            short: "Zo",
        },
        {
            long: "Yotta-octets",
            short: "Yo",
        },
    ],
} as const;

type ByteSize
    = | (typeof BYTE_SIZES)["iec_octet"][number]["short"]
        | (typeof BYTE_SIZES)["iec"][number]["short"]
        | (typeof BYTE_SIZES)["metric_octet"][number]["short"]
        | (typeof BYTE_SIZES)["metric"][number]["short"];
type UnitSystem = keyof typeof BYTE_SIZES;

/**
 * Lookup order for `parseBytes`. The caller's `units` table is always tried
 * first; the remaining tables act as a fallback so a suffix that only exists in
 * another table (e.g. the IEC "KiB" while `units` is the default "metric") is
 * still recognized instead of collapsing to `NaN`.
 */
const UNIT_SYSTEMS: ReadonlyArray<UnitSystem> = ["metric", "iec", "metric_octet", "iec_octet"];

/**
 * IEC prefixes (Ki/Mi/Gi/…) are defined by IEC 80000-13 as powers of 1024. They
 * carry their own scale, so a matched IEC suffix pins the multiplier instead of
 * deferring to the `base` option — unlike the SI prefixes, which are ambiguous
 * in the wild and therefore stay governed by `base`.
 */
const IEC_BASE = 1024;

const isIecSystem = (system: UnitSystem): boolean => system === "iec" || system === "iec_octet";

/**
 * SI bit-unit reference table, level → labels. `pretty-bytes`/`filesize` expose
 * `bits: true` for formatting network throughput (e.g. "12.5 Mbit"). Bit
 * prefixes are unit-system agnostic, so a single table serves every unit system.
 */
const BIT_REFERENCE_TABLE: ReadonlyArray<{ long: string; short: string }> = [
    { long: "bits", short: "bit" },
    { long: "Kilobits", short: "kbit" },
    { long: "Megabits", short: "Mbit" },
    { long: "Gigabits", short: "Gbit" },
    { long: "Terabits", short: "Tbit" },
    { long: "Petabits", short: "Pbit" },
    { long: "Exabits", short: "Ebit" },
    { long: "Zettabits", short: "Zbit" },
    { long: "Yottabits", short: "Ybit" },
];

/**
 * Cache of per-locale decimal/thousand separators. `Intl.NumberFormat`
 * construction is one of the most expensive standard-library operations, so we
 * memoize the separators (which are derived from a freshly constructed
 * formatter) per locale instead of building two formatters on every call.
 */
const SEPARATOR_CACHE = new Map<string, { decimalSeparator: string; thousandSeparator: string }>();

const getLocaleSeparators = (locale: string): { decimalSeparator: string; thousandSeparator: string } => {
    let separators = SEPARATOR_CACHE.get(locale);

    if (separators === undefined) {
        const formatter = new Intl.NumberFormat(locale);

        separators = {
            decimalSeparator: formatter.format(1.1).replaceAll(/\p{Number}/gu, ""),
            thousandSeparator: formatter.format(11_111).replaceAll(/\p{Number}/gu, ""),
        };

        SEPARATOR_CACHE.set(locale, separators);
    }

    return separators;
};

/**
 * Parse a localized number to a float.
 * @param stringNumber
 * @param locale [optional] the locale that the number is represented in. Omit this parameter to use the current locale.
 */
const parseLocalizedNumber = (stringNumber: string, locale: string): number => {
    const { decimalSeparator, thousandSeparator } = getLocaleSeparators(locale);

    // Strip every grouping character first: locales such as fr-FR/sv-SE group with
    // a U+00A0/U+202F no-break space and de-CH with an apostrophe, none of which
    // survive a `\`-escaped single-char strip of the locale's thousandSeparator.
    const withoutGrouping = stringNumber.replaceAll(/[\p{Zs}'’]/gu, "");

    return Number.parseFloat(withoutGrouping.replaceAll(new RegExp(`\\${thousandSeparator}`, "g"), "").replace(new RegExp(`\\${decimalSeparator}`), "."));
};

/**
 * Cache of `Intl.NumberFormat` instances keyed by locale + serialized options.
 * Formatter construction dominates the cost of `formatBytes` in loops over many
 * rows/files, so we reuse instances when the locale and options are identical.
 */
const NUMBER_FORMAT_CACHE = new Map<string, Intl.NumberFormat>();

const getNumberFormat = (locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat => {
    const cacheKey = `${locale}\u0000${JSON.stringify(options)}`;

    let formatter = NUMBER_FORMAT_CACHE.get(cacheKey);

    if (formatter === undefined) {
        formatter = new Intl.NumberFormat(locale, options);

        NUMBER_FORMAT_CACHE.set(cacheKey, formatter);
    }

    return formatter;
};

const fromBase = (base: 2 | 10): number => {
    switch (base) {
        case 2: {
            return 1024;
        }

        case 10: {
            return 1000;
        }

        default: {
            throw new Error("Unsupported base.");
        }
    }
};

/**
 * Merge the `decimals`-derived fraction digits with caller-supplied
 * `Intl.NumberFormat` options. The caller's explicit min/max fraction digits
 * win (so `decimals` is ignored when they are set), as documented on the option.
 */
const buildNumberFormatOptions = (
    fractionDigits: number | undefined,
    signDisplay: Intl.NumberFormatOptions,
    l10nOptions: Intl.NumberFormatOptions,
): Intl.NumberFormatOptions => {
    return {
        maximumFractionDigits: fractionDigits,
        minimumFractionDigits: fractionDigits,
        ...signDisplay,
        ...l10nOptions,
    };
};

const resolveRequestedUnitIndex = (
    requestedUnit: ByteSize | undefined,
    referenceTable: ReadonlyArray<{ long: string; short: string }>,
    units: keyof typeof BYTE_SIZES,
    bits: boolean,
): number => {
    if (requestedUnit === undefined) {
        return -1;
    }

    const index = referenceTable.findIndex((unit) => unit.short === requestedUnit);

    // The `unit` option is typed as a byte short (e.g. "MB"), which never matches
    // the bit reference table's shorts ("Mbit"). Map the requested byte short to
    // its power level via the byte table and pin the equivalent bit unit, so
    // `{ bits: true, unit: "MB" }` honors the pin instead of silently ignoring it.
    if (index === -1 && bits) {
        return BYTE_SIZES[units].findIndex((unit) => unit.short === requestedUnit);
    }

    return index;
};

/**
 * Resolve an upper-cased suffix ("KIB", "KILOBYTES", "KO", …) to its power level
 * and the unit system it came from. The preferred system wins on a tie, so
 * `units` still decides how an ambiguous suffix is read; every other system is
 * consulted afterwards so an explicitly spelled suffix is never rejected merely
 * because it belongs to a different table than the configured one.
 * @param type The upper-cased suffix taken from the parsed input.
 * @param preferred The unit system requested through the `units` option.
 */
const resolveUnitSystem = (type: string, preferred: UnitSystem): { level: number; system: UnitSystem } | undefined => {
    for (const system of [preferred, ...UNIT_SYSTEMS.filter((candidate) => candidate !== preferred)]) {
        const level = BYTE_SIZES[system].findIndex((unit) => unit.short.toUpperCase() === type || unit.long.toUpperCase() === type);

        if (level !== -1) {
            return { level, system };
        }
    }

    return undefined;
};

/**
 * Parse the given bytesize string and return bytes.
 *
 * Suffixes are resolved against the `units` table first and against the other
 * unit tables afterwards, so IEC input (`"1KiB"`) parses under every `units`
 * setting. A matched IEC suffix always scales by 1024; SI suffixes scale by the
 * `base` option (default `2`, i.e. `"1KB"` is 1024).
 * @param value The string to parse
 * @param options Options for the conversion from string to bytes
 * @throws Error if `value` is not a non-empty string or a number
 */
export const parseBytes = (value: string, options?: ParseByteOptions): number => {
    const config = {
        base: 2,
        locale: "en-US",
        units: "metric",
        ...options,
    } as Required<ParseByteOptions>;

    if (typeof value !== "string" || value.length === 0) {
        throw new TypeError("Value is not a string or is empty.");
    }

    if (value.length > 100) {
        throw new TypeError("Value exceeds the maximum length of 100 characters.");
    }

    const match = PARSE_BYTES_REGEX.exec(value);
    // Named capture groups need to be manually typed today.
    // https://github.com/microsoft/TypeScript/issues/32098
    const groups = match?.groups as { type?: string; value: string } | undefined;

    if (!groups) {
        return Number.NaN;
    }

    const localizedNumber = parseLocalizedNumber(groups.value, config.locale);
    const resolved = resolveUnitSystem((groups.type ?? "Bytes").toUpperCase(), config.units);

    if (resolved === undefined) {
        return Number.NaN;
    }

    // Called unconditionally so an unsupported `base` still throws, even when the
    // matched IEC suffix goes on to override it.
    const configuredBase = fromBase(config.base);
    const base = isIecSystem(resolved.system) ? IEC_BASE : configuredBase;

    return localizedNumber * base ** resolved.level;
};

/**
 * Formats the given bytes into a human-readable string.
 * Per default, it will use the closest unit to the given value.
 * @param bytes The bytes to format
 * @param options Options for the conversion from bytes to string
 */
export const formatBytes = (bytes: number, options?: FormatBytesOptions<ByteSize>): string => {
    if (typeof bytes !== "number" || !Number.isFinite(bytes)) {
        throw new TypeError("Bytesize is not a number.");
    }

    const {
        base: givenBase,
        bits,
        decimals,
        locale,
        long,
        signed,

        unit: requestedUnit,
        units,
        ...l10nOptions
    } = {
        base: 2,
        bits: false,
        decimals: 0,
        locale: "en-US",
        long: false,
        signed: false,
        units: "metric",
        ...options,
    } as Required<FormatBytesOptions<ByteSize>>;
    const base = fromBase(givenBase);

    // When formatting bits, work in bits internally (1 byte = 8 bits) and emit
    // bit-suffixed unit labels (e.g. "kbit", "Kilobits") instead of byte labels.
    const valueToFormat = bits ? bytes * 8 : bytes;
    const absoluteBytes = Math.abs(valueToFormat);
    const space = options?.space ?? true ? " " : "";
    const referenceTable: ReadonlyArray<{ long: string; short: string }> = bits ? BIT_REFERENCE_TABLE : BYTE_SIZES[units];

    const requestedUnitIndex = resolveRequestedUnitIndex(requestedUnit, referenceTable, units, bits);

    const fractionDigits = decimals < 0 ? undefined : decimals;
    const signDisplay: Intl.NumberFormatOptions = signed ? { signDisplay: "exceptZero" } : {};

    if (valueToFormat === 0) {
        const level = requestedUnitIndex === -1 ? 0 : Math.min(requestedUnitIndex, referenceTable.length - 1);
        const zeroUnit = (referenceTable[level] as { long: string; short: string })[long ? "long" : "short"];

        return getNumberFormat(locale, { ...signDisplay, ...l10nOptions }).format(0) + space + zeroUnit;
    }

    // Clamp the computed level to a valid table index. For 0 < |value| < base
    // the log is negative, so without clamping `referenceTable[-1]` would be
    // undefined and the unit lookup would throw a TypeError.
    const computedLevel = Math.max(0, Math.min(Math.floor(Math.log(absoluteBytes) / Math.log(base)), referenceTable.length - 1));
    const level = requestedUnitIndex === -1 ? computedLevel : requestedUnitIndex;
    const unit = (referenceTable[level] as { long: string; short: string })[long ? "long" : "short"];

    const value = valueToFormat / base ** level;
    const formattedValue = getNumberFormat(locale, buildNumberFormatOptions(fractionDigits, signDisplay, l10nOptions)).format(value);

    return formattedValue + space + unit;
};
