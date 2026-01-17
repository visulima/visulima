/**
 * Mapping from ISO 639-3 (3-letter) to ISO 639-1 (2-letter) language codes
 * Only includes codes that are actually used in the country data
 */
const iso6393To6391Map: Record<string, string> = {
    // Most common languages
    eng: "en",
    fra: "fr",
    spa: "es",
    deu: "de",
    ita: "it",
    por: "pt",
    rus: "ru",
    jpn: "ja",
    kor: "ko",
    zho: "zh",
    ara: "ar",
    hin: "hi",
    ben: "bn",
    urd: "ur",
    tur: "tr",
    pol: "pl",
    ukr: "uk",
    ron: "ro",
    nld: "nl",
    ell: "el",
    ces: "cs",
    swe: "sv",
    hun: "hu",
    fin: "fin",
    dan: "da",
    nor: "no",
    slk: "sk",
    bul: "bg",
    hrv: "hr",
    srp: "sr",
    slv: "sl",
    est: "et",
    lav: "lv",
    lit: "lt",
    mlt: "mt",
    gle: "ga",
    cym: "cy",
    cat: "ca",
    eus: "eu",
    glg: "gl",
    isl: "is",
    fao: "fo",
    mkd: "mk",
    sqi: "sq",
    bos: "bs",
    heb: "he",
    amh: "am",
    swa: "sw",
    hau: "ha",
    yor: "yo",
    ibo: "ig",
    zul: "zu",
    xho: "xh",
    afr: "af",
    nbl: "nr",
    nso: "ns",
    sot: "st",
    tso: "ts",
    tha: "th",
    vie: "vi",
    ind: "id",
    msa: "ms",
    fil: "tl",
    mya: "my",
    khm: "km",
    lao: "lo",
    kat: "ka",
    hye: "hy",
    aze: "az",
    mon: "mn",
    nep: "ne",
    sin: "si",
    tam: "ta",
    tel: "te",
    kan: "kn",
    mal: "ml",
    guj: "gu",
    pan: "pa",
    ori: "or",
    asm: "as",
    mar: "mr",
    mai: "mai",
    // Additional codes found in country data
    cor: "kw", // Cornish
    gla: "gd", // Scottish Gaelic
    gsw: "gsw", // Swiss German (no ISO 639-1)
    roh: "rm", // Romansh
    cos: "co", // Corsican
    mfe: "mfe", // Mauritian Creole (no ISO 639-1)
    bjz: "bjz", // Belize Kriol English (no ISO 639-1)
    bwg: "bwg", // Barwe (no ISO 639-1)
    kck: "kck", // Kalanga (no ISO 639-1)
    khi: "khi", // Khoisan languages (no ISO 639-1)
    ndc: "ndc", // Ndau (no ISO 639-1)
    nde: "nd", // North Ndebele
    nya: "ny", // Chichewa
    sna: "sn", // Shona
    toi: "toi", // Tonga (no ISO 639-1)
    ber: "ber", // Berber languages (no ISO 639-1)
    kon: "kg", // Kongo
    lin: "ln", // Lingala
    lua: "lua", // Luba-Lulua (no ISO 639-1)
    run: "rn", // Kirundi
    sag: "sg", // Sango
    ssw: "ss", // Swati
    tsn: "tn", // Tswana
    bnt: "bnt", // Bantu languages (no ISO 639-1)
    pus: "ps", // Pashto
    prs: "prs", // Dari (no ISO 639-1)
    tuk: "tk", // Turkmen
    uig: "ug", // Uyghur
    div: "dv", // Dhivehi
    dzo: "dz", // Dzongkha
    tgk: "tg", // Tajik
    mri: "mi", // Maori
    nau: "na", // Nauru
    niu: "niu", // Niuean (no ISO 639-1)
    smo: "sm", // Samoan
    ton: "to", // Tongan
    tvl: "tvl", // Tuvaluan (no ISO 639-1)
    bis: "bi", // Bislama
    cal: "cal", // Carolinian (no ISO 639-1)
    cha: "ch", // Chamorro
    mah: "mh", // Marshallese
    pau: "pau", // Palauan (no ISO 639-1)
    rar: "rar", // Rarotongan (no ISO 639-1)
    gil: "gil", // Gilbertese (no ISO 639-1)
    pov: "pov", // Upper Guinea Creole (no ISO 639-1)
    tet: "tet", // Tetum (no ISO 639-1)
} as const;

/**
 * Convert ISO 639-3 (3-letter) code to ISO 639-1 (2-letter) code
 * @param iso6393 - ISO 639-3 language code (e.g., "eng")
 * @returns ISO 639-1 code (e.g., "en") or undefined if not found
 */
export const iso6393To6391 = (iso6393: string): string | undefined => {
    return iso6393To6391Map[iso6393.toLowerCase()];
};

/**
 * Get all ISO 639-1 codes from ISO 639-3 codes
 * @param iso6393Codes - Array of ISO 639-3 codes
 * @returns Array of ISO 639-1 codes (filtered to only valid mappings)
 */
export const convert6393To6391 = (iso6393Codes: string[]): string[] => {
    return iso6393Codes.map((code) => iso6393To6391(code)).filter((code): code is string => code !== undefined);
};
