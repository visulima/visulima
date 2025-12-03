import type { FormateByteOptions, ParseByteOptions } from "./types";

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

const fromBase = (base: 2 | 10) => {
    if (base === 2) {
        return 1024;
    }

    if (base === 10) {
        return 1000;
    }

    throw new TypeError(`Unsupported base.`);
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

    const match
        // eslint-disable-next-line regexp/no-super-linear-backtracking,regexp/no-unused-capturing-group,regexp/no-misleading-capturing-group,sonarjs/slow-regex,sonarjs/regex-complexity
        = /^(?<value>-?(?:\d+(([.,])\d+)*)?[.,]?\d+) *(?<type>bytes?|b|kb|kib|mb|mib|gb|gib|tb|tib|pb|pib|eb|eib|zb|zib|yb|yib|(kilo|kibi|mega|mebi|giga|gibi|tera|tebi|peta|pebi|exa|exbi|zetta|zebi|yotta|yobi)?bytes)?$/i.exec(
            value,
        );
    // Named capture groups need to be manually typed today.
    // https://github.com/microsoft/TypeScript/issues/32098
    const groups = match?.groups as { type?: string; value: string } | undefined;

    if (!groups) {
        return Number.NaN;
    }

    const localizedNumber = parseLocalizedNumber(groups.value, config.locale);
    const type = (groups.type ?? "Bytes")
        .toUpperCase()
        .replace(/^KIBI/, "KILO")
        .replace(/^MIBI/, "MEGA")
        .replace(/^GIBI/, "GIGA")
        .replace(/^TEBI/, "TERA")
        .replace(/^PEBI/, "PETA")
        .replace(/^EXBI/, "EXA")
        .replace(/^ZEBI/, "ZETTA")
        .replace(/^YIBI/, "YOTTA")
        .replace(/^(.)IB$/, "$1B") as Uppercase<Unit> | "B";
    const level = BYTE_SIZES[config.units].findIndex((unit) => (unit.short[0] as string).toUpperCase() === type[0]);
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
    const base = fromBase(givenBase as 2 | 10);

    const absoluteBytes = Math.abs(bytes);
    const space = options?.space ?? true ? " " : "";
    const referenceTable = BYTE_SIZES[units];

    const requestedUnitIndex = referenceTable.findIndex((unit) => unit.short === requestedUnit);

    if (bytes === 0) {
        const level = Math.min(0, Math.max(requestedUnitIndex, referenceTable.length - 1));

        // eslint-disable-next-line prefer-template
        return "0" + space + (referenceTable[level] as { long: string; short: string })[long ? "long" : "short"];
    }

    const level = requestedUnitIndex === -1 ? Math.min(Math.floor(Math.log(absoluteBytes) / Math.log(base)), referenceTable.length - 1) : requestedUnitIndex;
    const unit = (referenceTable[level] as { long: string; short: string })[long ? "long" : "short"];

    const value = bytes / base ** level;
    const fractionDigits = (decimals as number) < 0 ? undefined : decimals;
    const formattedValue = new Intl.NumberFormat(locale, {
        // @ts-expect-error - should be overridden by the options
        maximumFractionDigits: fractionDigits,
        // @ts-expect-error - should be overridden by the options
        minimumFractionDigits: fractionDigits,
        ...l10nOptions,
    }).format(value);

    return formattedValue + space + unit;
};
