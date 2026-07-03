/**
 * Mapping from ISO 639-3 (3-letter) to ISO 639-1 (2-letter) language codes
 * Only includes codes that are actually used in the country data
 */
const iso6393To6391Map: Record<string, string> = {
    afr: "af",
    amh: "am",
    ara: "ar",
    asm: "as",
    aze: "az",
    ben: "bn",
    ber: "ber", // Berber languages (no ISO 639-1)
    bis: "bi", // Bislama
    bjz: "bjz", // Belize Kriol English (no ISO 639-1)
    bnt: "bnt", // Bantu languages (no ISO 639-1)
    bos: "bs",
    bul: "bg",
    bwg: "bwg", // Barwe (no ISO 639-1)
    cal: "cal", // Carolinian (no ISO 639-1)
    cat: "ca",
    ces: "cs",
    cha: "ch", // Chamorro
    // Additional codes found in country data
    cor: "kw", // Cornish
    cos: "co", // Corsican
    cym: "cy",
    dan: "da",
    deu: "de",
    div: "dv", // Dhivehi
    dzo: "dz", // Dzongkha
    ell: "el",
    // Most common languages
    eng: "en",
    est: "et",
    eus: "eu",
    fao: "fo",
    fil: "tl",
    fin: "fi",
    fra: "fr",
    gil: "gil", // Gilbertese (no ISO 639-1)
    gla: "gd", // Scottish Gaelic
    gle: "ga",
    glg: "gl",
    gsw: "gsw", // Swiss German (no ISO 639-1)
    guj: "gu",
    hau: "ha",
    heb: "he",
    hin: "hi",
    hrv: "hr",
    hun: "hu",
    hye: "hy",
    ibo: "ig",
    ind: "id",
    isl: "is",
    ita: "it",
    jpn: "ja",
    kan: "kn",
    kat: "ka",
    kck: "kck", // Kalanga (no ISO 639-1)
    khi: "khi", // Khoisan languages (no ISO 639-1)
    khm: "km",
    kon: "kg", // Kongo
    kor: "ko",
    lao: "lo",
    lav: "lv",
    lin: "ln", // Lingala
    lit: "lt",
    lua: "lua", // Luba-Lulua (no ISO 639-1)
    mah: "mh", // Marshallese
    mai: "mai",
    mal: "ml",
    mar: "mr",
    mfe: "mfe", // Mauritian Creole (no ISO 639-1)
    mkd: "mk",
    mlt: "mt",
    mon: "mn",
    mri: "mi", // Maori
    msa: "ms",
    mya: "my",
    nau: "na", // Nauru
    nbl: "nr",
    ndc: "ndc", // Ndau (no ISO 639-1)
    nde: "nd", // North Ndebele
    nep: "ne",
    niu: "niu", // Niuean (no ISO 639-1)
    nld: "nl",
    nor: "no",
    nso: "ns",
    nya: "ny", // Chichewa
    ori: "or",
    pan: "pa",
    pau: "pau", // Palauan (no ISO 639-1)
    pol: "pl",
    por: "pt",
    pov: "pov", // Upper Guinea Creole (no ISO 639-1)
    prs: "prs", // Dari (no ISO 639-1)
    pus: "ps", // Pashto
    rar: "rar", // Rarotongan (no ISO 639-1)
    roh: "rm", // Romansh
    ron: "ro",
    run: "rn", // Kirundi
    rus: "ru",
    sag: "sg", // Sango
    sin: "si",
    slk: "sk",
    slv: "sl",
    smo: "sm", // Samoan
    sna: "sn", // Shona
    sot: "st",
    spa: "es",
    sqi: "sq",
    srp: "sr",
    ssw: "ss", // Swati
    swa: "sw",
    swe: "sv",
    tam: "ta",
    tel: "te",
    tet: "tet", // Tetum (no ISO 639-1)
    tgk: "tg", // Tajik
    tha: "th",
    toi: "toi", // Tonga (no ISO 639-1)
    ton: "to", // Tongan
    tsn: "tn", // Tswana
    tso: "ts",
    tuk: "tk", // Turkmen
    tur: "tr",
    tvl: "tvl", // Tuvaluan (no ISO 639-1)
    uig: "ug", // Uyghur
    ukr: "uk",
    urd: "ur",
    vie: "vi",
    xho: "xh",
    yor: "yo",
    zho: "zh",
    zul: "zu",
} as const;

/**
 * Converts ISO 639-3 (3-letter) code to ISO 639-1 (2-letter) code.
 * @param iso6393 ISO 639-3 language code (e.g., "eng")
 * @returns ISO 639-1 code (e.g., "en") or undefined if not found
 */
export const iso6393To6391 = (iso6393: string): string | undefined => iso6393To6391Map[iso6393.toLowerCase()];

/**
 * Gets all ISO 639-1 codes from ISO 639-3 codes.
 * @param iso6393Codes Array of ISO 639-3 codes
 * @returns Array of ISO 639-1 codes (filtered to only valid mappings)
 */
export const convert6393To6391 = (iso6393Codes: string[]): string[] =>
    iso6393Codes.map((code) => iso6393To6391(code)).filter((code): code is string => code !== undefined);
