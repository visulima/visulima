import type { FormateByteOptions, ParseByteOptions } from "./types";

// eslint-disable-next-line sonarjs/unused-named-groups -- named groups are used at line 228 via match.groups
const PARSE_BYTES_REGEX = /^(?<value>-?\d+(?:[.,]\d+)*) *(?<type>[a-z]+)?$/i;
const KIBI_REGEX = /^KIBI/;
const MIBI_REGEX = /^MIBI/;
const GIBI_REGEX = /^GIBI/;
const TEBI_REGEX = /^TEBI/;
const PEBI_REGEX = /^PEBI/;
const EXBI_REGEX = /^EXBI/;
const ZEBI_REGEX = /^ZEBI/;
const YIBI_REGEX = /^YIBI/;
const IB_SUFFIX_REGEX = /^(.)IB$/;

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
type LongByteSize
    = | (typeof BYTE_SIZES)["iec_octet"][number]["long"]
        | (typeof BYTE_SIZES)["iec"][number]["long"]
        | (typeof BYTE_SIZES)["metric_octet"][number]["long"]
        | (typeof BYTE_SIZES)["metric"][number]["long"];

type Unit = ByteSize | LongByteSize;

/**
 * Parse a localized number to a float.
 * @param stringNumber
 * @param locale [optional] the locale that the number is represented in. Omit this parameter to use the current locale.
 */
const parseLocalizedNumber = (stringNumber: string, locale: string): number => {
    const thousandSeparator = new Intl.NumberFormat(locale).format(11_111).replaceAll(/\p{Number}/gu, "");
    const decimalSeparator = new Intl.NumberFormat(locale).format(1.1).replaceAll(/\p{Number}/gu, "");

    return Number.parseFloat(stringNumber.replaceAll(new RegExp(`\\${thousandSeparator}`, "g"), "").replace(new RegExp(`\\${decimalSeparator}`), "."));
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
 * Parse the given bytesize string and return bytes.
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
    const type = (groups.type ?? "Bytes")
        .toUpperCase()
        .replace(KIBI_REGEX, "KILO")
        .replace(MIBI_REGEX, "MEGA")
        .replace(GIBI_REGEX, "GIGA")
        .replace(TEBI_REGEX, "TERA")
        .replace(PEBI_REGEX, "PETA")
        .replace(EXBI_REGEX, "EXA")
        .replace(ZEBI_REGEX, "ZETTA")
        .replace(YIBI_REGEX, "YOTTA")
        .replace(IB_SUFFIX_REGEX, "$1B") as Uppercase<Unit> | "B";
    const level = BYTE_SIZES[config.units].findIndex((unit) => unit.short.toUpperCase() === type || unit.long.toUpperCase() === type);

    if (level === -1) {
        return Number.NaN;
    }

    const base = fromBase(config.base);

    return localizedNumber * base ** level;
};

/**
 * Formats the given bytes into a human-readable string.
 * Per default, it will use the closest unit to the given value.
 * @param bytes The bytes to format
 * @param options Options for the conversion from bytes to string
 */
export const formatBytes = (bytes: number, options?: FormateByteOptions<ByteSize>): string => {
    if (typeof bytes !== "number" || !Number.isFinite(bytes)) {
        throw new TypeError("Bytesize is not a number.");
    }

    const {
        base: givenBase,
        decimals,
        locale,
        long,

        unit: requestedUnit,
        units,
        ...l10nOptions
    } = {
        base: 2,
        decimals: 0,
        locale: "en-US",
        long: false,
        units: "metric",
        ...options,
    } as Required<FormateByteOptions<ByteSize>>;
    const base = fromBase(givenBase);

    const absoluteBytes = Math.abs(bytes);
    const space = options?.space ?? true ? " " : "";
    const referenceTable = BYTE_SIZES[units];

    const requestedUnitIndex = referenceTable.findIndex((unit) => unit.short === requestedUnit);

    if (bytes === 0) {
        const level = requestedUnitIndex === -1 ? 0 : Math.min(requestedUnitIndex, referenceTable.length - 1);

        // eslint-disable-next-line prefer-template
        return "0" + space + (referenceTable[level] as { long: string; short: string })[long ? "long" : "short"];
    }

    const level = requestedUnitIndex === -1 ? Math.min(Math.floor(Math.log(absoluteBytes) / Math.log(base)), referenceTable.length - 1) : requestedUnitIndex;
    const unit = (referenceTable[level] as { long: string; short: string })[long ? "long" : "short"];

    const value = bytes / base ** level;
    const fractionDigits = decimals < 0 ? undefined : decimals;
    const formattedValue = new Intl.NumberFormat(locale, {
        // @ts-expect-error - should be overridden by the options
        maximumFractionDigits: fractionDigits,
        // @ts-expect-error - should be overridden by the options
        minimumFractionDigits: fractionDigits,
        ...l10nOptions,
    }).format(value);

    return formattedValue + space + unit;
};
