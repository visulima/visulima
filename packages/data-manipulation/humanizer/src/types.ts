interface BytesOptions {
    /**
     * The base to use for the conversion.
     * @default 2
     */
    base?: 2 | 10;

    /**
     * The default locale to use for parsing/formatting the output.
     * @default 'en-US'
     */
    locale?: IntlLocale;

    /**
     * The unit to use for the output.
     * @default "metric"
     */
    units?: "iec_octet" | "iec" | "metric_octet" | "metric";
}

export type IntlLocale
    = | "af-NA"
        | "af"
        | "agq"
        | "ak"
        | "am"
        | "ar-AE"
        | "ar-BH"
        | "ar-DJ"
        | "ar-DZ"
        | "ar-EG"
        | "ar-EH"
        | "ar-ER"
        | "ar-IL"
        | "ar-IQ"
        | "ar-JO"
        | "ar-KM"
        | "ar-KW"
        | "ar-LB"
        | "ar-LY"
        | "ar-MA"
        | "ar-MR"
        | "ar-OM"
        | "ar-PS"
        | "ar-QA"
        | "ar-SA"
        | "ar-SD"
        | "ar-SO"
        | "ar-SS"
        | "ar-SY"
        | "ar-TD"
        | "ar-TN"
        | "ar-YE"
        | "ar"
        | "as"
        | "asa"
        | "ast"
        | "az-Cyrl"
        | "az-Latn"
        | "az"
        | "bas"
        | "be-tarask"
        | "be"
        | "bem"
        | "bez"
        | "bg"
        | "bm"
        | "bn-IN"
        | "bn"
        | "bo-IN"
        | "bo"
        | "br"
        | "brx"
        | "bs-Cyrl"
        | "bs-Latn"
        | "bs"
        | "ca-AD"
        | "ca-ES-valencia"
        | "ca-FR"
        | "ca-IT"
        | "ca"
        | "ccp-IN"
        | "ccp"
        | "ce"
        | "ceb"
        | "cgg"
        | "chr"
        | "ckb-IR"
        | "ckb"
        | "cs"
        | "cy"
        | "da-GL"
        | "da"
        | "dav"
        | "de-AT"
        | "de-BE"
        | "de-CH"
        | "de-IT"
        | "de-LI"
        | "de-LU"
        | "de"
        | "dje"
        | "doi"
        | "dsb"
        | "dua"
        | "dyo"
        | "dz"
        | "ebu"
        | "ee-TG"
        | "ee"
        | "el-CY"
        | "el"
        | "en-001"
        | "en-150"
        | "en-AE"
        | "en-AG"
        | "en-AI"
        | "en-AS"
        | "en-AT"
        | "en-AU"
        | "en-BB"
        | "en-BE"
        | "en-BI"
        | "en-BM"
        | "en-BS"
        | "en-BW"
        | "en-BZ"
        | "en-CA"
        | "en-CC"
        | "en-CH"
        | "en-CK"
        | "en-CM"
        | "en-CX"
        | "en-CY"
        | "en-DE"
        | "en-DG"
        | "en-DK"
        | "en-DM"
        | "en-ER"
        | "en-FI"
        | "en-FJ"
        | "en-FK"
        | "en-FM"
        | "en-GB"
        | "en-GD"
        | "en-GG"
        | "en-GH"
        | "en-GI"
        | "en-GM"
        | "en-GU"
        | "en-GY"
        | "en-HK"
        | "en-IE"
        | "en-IL"
        | "en-IM"
        | "en-IN"
        | "en-IO"
        | "en-JE"
        | "en-JM"
        | "en-KE"
        | "en-KI"
        | "en-KN"
        | "en-KY"
        | "en-LC"
        | "en-LR"
        | "en-LS"
        | "en-MG"
        | "en-MH"
        | "en-MO"
        | "en-MP"
        | "en-MS"
        | "en-MT"
        | "en-MU"
        | "en-MW"
        | "en-MY"
        | "en-NA"
        | "en-NF"
        | "en-NG"
        | "en-NL"
        | "en-NR"
        | "en-NU"
        | "en-NZ"
        | "en-PG"
        | "en-PH"
        | "en-PK"
        | "en-PN"
        | "en-PR"
        | "en-PW"
        | "en-RW"
        | "en-SB"
        | "en-SC"
        | "en-SD"
        | "en-SE"
        | "en-SG"
        | "en-SH"
        | "en-SI"
        | "en-SL"
        | "en-SS"
        | "en-SX"
        | "en-SZ"
        | "en-TC"
        | "en-TK"
        | "en-TO"
        | "en-TT"
        | "en-TV"
        | "en-TZ"
        | "en-UG"
        | "en-UM"
        | "en-VC"
        | "en-VG"
        | "en-VI"
        | "en-VU"
        | "en-WS"
        | "en-ZA"
        | "en-ZM"
        | "en-ZW"
        | "en"
        | "eo"
        | "es-419"
        | "es-AR"
        | "es-BO"
        | "es-BR"
        | "es-BZ"
        | "es-CL"
        | "es-CO"
        | "es-CR"
        | "es-CU"
        | "es-DO"
        | "es-EA"
        | "es-EC"
        | "es-GQ"
        | "es-GT"
        | "es-HN"
        | "es-IC"
        | "es-MX"
        | "es-NI"
        | "es-PA"
        | "es-PE"
        | "es-PH"
        | "es-PR"
        | "es-PY"
        | "es-SV"
        | "es-US"
        | "es-UY"
        | "es-VE"
        | "es"
        | "et"
        | "eu"
        | "ewo"
        | "fa-AF"
        | "fa"
        | "ff-Adlm-BF"
        | "ff-Adlm-CM"
        | "ff-Adlm-GH"
        | "ff-Adlm-GM"
        | "ff-Adlm-GW"
        | "ff-Adlm-LR"
        | "ff-Adlm-MR"
        | "ff-Adlm-NE"
        | "ff-Adlm-NG"
        | "ff-Adlm-SL"
        | "ff-Adlm-SN"
        | "ff-Adlm"
        | "ff-Latn-BF"
        | "ff-Latn-CM"
        | "ff-Latn-GH"
        | "ff-Latn-GM"
        | "ff-Latn-GN"
        | "ff-Latn-GW"
        | "ff-Latn-LR"
        | "ff-Latn-MR"
        | "ff-Latn-NE"
        | "ff-Latn-NG"
        | "ff-Latn-SL"
        | "ff-Latn"
        | "ff"
        | "fi"
        | "fil"
        | "fo-DK"
        | "fo"
        | "fr-BE"
        | "fr-BF"
        | "fr-BI"
        | "fr-BJ"
        | "fr-BL"
        | "fr-CA"
        | "fr-CD"
        | "fr-CF"
        | "fr-CG"
        | "fr-CH"
        | "fr-CI"
        | "fr-CM"
        | "fr-DJ"
        | "fr-DZ"
        | "fr-GA"
        | "fr-GF"
        | "fr-GN"
        | "fr-GP"
        | "fr-GQ"
        | "fr-HT"
        | "fr-KM"
        | "fr-LU"
        | "fr-MA"
        | "fr-MC"
        | "fr-MF"
        | "fr-MG"
        | "fr-ML"
        | "fr-MQ"
        | "fr-MR"
        | "fr-MU"
        | "fr-NC"
        | "fr-NE"
        | "fr-PF"
        | "fr-PM"
        | "fr-RE"
        | "fr-RW"
        | "fr-SC"
        | "fr-SN"
        | "fr-SY"
        | "fr-TD"
        | "fr-TG"
        | "fr-TN"
        | "fr-VU"
        | "fr-WF"
        | "fr-YT"
        | "fr"
        | "fur"
        | "fy"
        | "ga-GB"
        | "ga"
        | "gd"
        | "gl"
        | "gsw-FR"
        | "gsw-LI"
        | "gsw"
        | "gu"
        | "guz"
        | "gv"
        | "ha-GH"
        | "ha-NE"
        | "ha"
        | "haw"
        | "he"
        | "hi"
        | "hr-BA"
        | "hr"
        | "hsb"
        | "hu"
        | "hy"
        | "ia"
        | "id"
        | "ig"
        | "ii"
        | "is"
        | "it-CH"
        | "it-SM"
        | "it-VA"
        | "it"
        | "ja"
        | "jgo"
        | "jmc"
        | "jv"
        | "ka"
        | "kab"
        | "kam"
        | "kde"
        | "kea"
        | "kgp"
        | "khq"
        | "ki"
        | "kk"
        | "kkj"
        | "kl"
        | "kln"
        | "km"
        | "kn"
        | "ko-KP"
        | "ko"
        | "kok"
        | "ks-Arab"
        | "ks"
        | "ksb"
        | "ksf"
        | "ksh"
        | "ku"
        | "kw"
        | "ky"
        | "lag"
        | "lb"
        | "lg"
        | "lkt"
        | "ln-AO"
        | "ln-CF"
        | "ln-CG"
        | "ln"
        | "lo"
        | "lrc-IQ"
        | "lrc"
        | "lt"
        | "lu"
        | "luo"
        | "luy"
        | "lv"
        | "mai"
        | "mas-TZ"
        | "mas"
        | "mer"
        | "mfe"
        | "mg"
        | "mgh"
        | "mgo"
        | "mi"
        | "mk"
        | "ml"
        | "mn"
        | "mni-Beng"
        | "mni"
        | "mr"
        | "ms-BN"
        | "ms-ID"
        | "ms-SG"
        | "ms"
        | "mt"
        | "mua"
        | "my"
        | "mzn"
        | "naq"
        | "nb-SJ"
        | "nb"
        | "nd"
        | "nds-NL"
        | "nds"
        | "ne-IN"
        | "ne"
        | "nl-AW"
        | "nl-BE"
        | "nl-BQ"
        | "nl-CW"
        | "nl-SR"
        | "nl-SX"
        | "nl"
        | "nmg"
        | "nn"
        | "nnh"
        | "no"
        | "nus"
        | "nyn"
        | "om-KE"
        | "om"
        | "or"
        | "os-RU"
        | "os"
        | "pa-Arab"
        | "pa-Guru"
        | "pa"
        | "pcm"
        | "pl"
        | "ps-PK"
        | "ps"
        | "pt-AO"
        | "pt-CH"
        | "pt-CV"
        | "pt-GQ"
        | "pt-GW"
        | "pt-LU"
        | "pt-MO"
        | "pt-MZ"
        | "pt-PT"
        | "pt-ST"
        | "pt-TL"
        | "pt"
        | "qu-BO"
        | "qu-EC"
        | "qu"
        | "rm"
        | "rn"
        | "ro-MD"
        | "ro"
        | "rof"
        | "ru-BY"
        | "ru-KG"
        | "ru-KZ"
        | "ru-MD"
        | "ru-UA"
        | "ru"
        | "rw"
        | "rwk"
        | "sa"
        | "sah"
        | "saq"
        | "sat-Olck"
        | "sat"
        | "sbp"
        | "sc"
        | "sd-Arab"
        | "sd-Deva"
        | "sd"
        | "se-FI"
        | "se-SE"
        | "se"
        | "seh"
        | "ses"
        | "sg"
        | "shi-Latn"
        | "shi-Tfng"
        | "shi"
        | "si"
        | "sk"
        | "sl"
        | "smn"
        | "sn"
        | "so-DJ"
        | "so-ET"
        | "so-KE"
        | "so"
        | "sq-MK"
        | "sq-XK"
        | "sq"
        | "sr-Cyrl-BA"
        | "sr-Cyrl-ME"
        | "sr-Cyrl-XK"
        | "sr-Cyrl"
        | "sr-Latn-BA"
        | "sr-Latn-ME"
        | "sr-Latn-XK"
        | "sr-Latn"
        | "sr"
        | "su-Latn"
        | "su"
        | "sv-AX"
        | "sv-FI"
        | "sv"
        | "sw-CD"
        | "sw-KE"
        | "sw-UG"
        | "sw"
        | "ta-LK"
        | "ta-MY"
        | "ta-SG"
        | "ta"
        | "te"
        | "teo-KE"
        | "teo"
        | "tg"
        | "th"
        | "ti-ER"
        | "ti"
        | "tk"
        | "to"
        | "tr-CY"
        | "tr"
        | "tt"
        | "twq"
        | "tzm"
        | "ug"
        | "uk"
        | "und"
        | "ur-IN"
        | "ur"
        | "uz-Arab"
        | "uz-Cyrl"
        | "uz-Latn"
        | "uz"
        | "vai-Latn"
        | "vai-Vaii"
        | "vai"
        | "vi"
        | "vun"
        | "wae"
        | "wo"
        | "xh"
        | "xog"
        | "yav"
        | "yi"
        | "yo-BJ"
        | "yo"
        | "yrl-CO"
        | "yrl-VE"
        | "yrl"
        | "yue-Hans"
        | "yue-Hant"
        | "yue"
        | "zgh"
        | "zh-Hans-HK"
        | "zh-Hans-MO"
        | "zh-Hans-SG"
        | "zh-Hans"
        | "zh-Hant-HK"
        | "zh-Hant-MO"
        | "zh-Hant"
        | "zh"
        | "zu";

export type DurationUnit = string | ((unitCount: number) => string);

export type DurationUnitName = "d" | "h" | "m" | "mo" | "ms" | "s" | "w" | "y";

export interface DurationUnitMeasures {
    d: number;
    h: number;
    m: number;
    mo: number;
    ms: number;
    s: number;
    w: number;
    y: number;
}

export type DurationDigitReplacements = [string, string, string, string, string, string, string, string, string, string];

export interface DurationLanguage {
    _digitReplacements?: DurationDigitReplacements;
    _hideCountIf2?: boolean;
    _numberFirst?: boolean;
    d: DurationUnit;

    /**
     * Optional character used as the decimal separator for number parsing.
     * Defaults to ".".
     */
    decimal?: string;
    delimiter?: string;
    future?: string;

    /**
     * Optional character used as the grouping separator (e.g., thousands) for number parsing.
     * Defaults to ",".
     */
    groupSeparator?: string;
    h: DurationUnit;
    m: DurationUnit;
    mo: DurationUnit;
    ms: DurationUnit;
    past?: string;

    /**
     * Optional placeholder character within numbers used during parsing.
     * Defaults to "_".
     */
    placeholderSeparator?: string;
    s: DurationUnit;

    /**
     * Optional mapping of localized unit names/aliases (e.g., "saniye", "sec")
     * to the standard unit keys (e.g., "s"). Used for parsing.
     */
    unitMap?: Record<string, keyof DurationUnitMeasures>;
    w: DurationUnit;
    y: DurationUnit;
}

export interface DurationOptions {
    conjunction?: string;
    decimal?: string;
    delimiter?: string;
    digitReplacements?: DurationDigitReplacements;
    fallbacks?: string[];
    language?: DurationLanguage;
    largest?: number;
    maxDecimalPoints?: number;
    round?: boolean;
    serialComma?: boolean;
    spacer?: string;
    timeAdverb?: boolean;
    unitMeasures?: DurationUnitMeasures;
    units?: DurationUnitName[];
}

export interface DurationPiece {
    unitCount: number;
    unitName: DurationUnitName;
}

export type ParseByteOptions = BytesOptions;
export interface FormateByteOptions<ByteSize>
    extends BytesOptions, Omit<Intl.NumberFormatOptions, "currency" | "currencyDisplay" | "currencySign" | "style" | "unit" | "unitDisplay"> {
    /**
     * Specify the number of decimals to include in the output.
     *
     * **Note**: If `minFractionDigits` or `maxFractionDigits` are set, this option will be ignored.
     * @default 0
     */
    decimals?: number;

    /**
     * Whether to use the long form of the unit.
     * @default false
     */
    long?: boolean;

    /**
     * Whether to include a space between the number and the unit.
     * @default true
     */
    space?: boolean;

    /**
     * Specify the unit to use for the output.
     *
     * Uses the closest unit to the given value per default.
     */
    unit?: ByteSize;
}

/**
 * Options for the parseDuration function.
 */
export interface ParseDurationOptions {
    /**
     * The default unit to use if the input string is just a number.
     * Uses standard unit keys (y, mo, w, d, h, m, s, ms).
     * Defaults to 'ms'.
     */
    defaultUnit?: keyof DurationUnitMeasures;

    /**
     * The language object containing localized unit names for parsing.
     * Defaults to English.
     */
    language?: DurationLanguage;
}
