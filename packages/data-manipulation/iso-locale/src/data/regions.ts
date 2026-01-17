import type { Region } from "../types";

/**
 * Country to region mapping based on UN geoscheme
 * Maps ISO 3166-1 alpha-2 country codes to their UN geoscheme regions
 */
const countryRegions: Record<string, Region> = {
    // Africa - Northern Africa
    DZ: { continent: "Africa", subregion: "Northern Africa" },
    EG: { continent: "Africa", subregion: "Northern Africa" },
    LY: { continent: "Africa", subregion: "Northern Africa" },
    MA: { continent: "Africa", subregion: "Northern Africa" },
    SD: { continent: "Africa", subregion: "Northern Africa" },
    TN: { continent: "Africa", subregion: "Northern Africa" },
    EH: { continent: "Africa", subregion: "Northern Africa" }, // Western Sahara

    // Africa - Eastern Africa (Sub-Saharan Africa)
    IO: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" }, // British Indian Ocean Territory
    BI: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" },
    KM: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" },
    DJ: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" },
    ER: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" },
    ET: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" },
    TF: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" }, // French Southern Territories
    KE: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" },
    MG: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" },
    MW: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" },
    MU: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" },
    YT: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" }, // Mayotte
    MZ: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" },
    RE: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" }, // Réunion
    RW: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" },
    SC: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" },
    SO: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" },
    SS: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" }, // South Sudan
    UG: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" },
    TZ: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" },
    ZM: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" },
    ZW: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" },

    // Africa - Middle Africa (Sub-Saharan Africa)
    AO: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Middle Africa" },
    CM: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Middle Africa" },
    CF: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Middle Africa" },
    TD: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Middle Africa" },
    CG: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Middle Africa" },
    CD: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Middle Africa" },
    GQ: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Middle Africa" },
    GA: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Middle Africa" },
    ST: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Middle Africa" },

    // Africa - Southern Africa (Sub-Saharan Africa)
    BW: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Southern Africa" },
    SZ: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Southern Africa" }, // Eswatini
    LS: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Southern Africa" },
    NA: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Southern Africa" },
    ZA: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Southern Africa" },

    // Africa - Western Africa (Sub-Saharan Africa)
    BJ: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Western Africa" },
    BF: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Western Africa" },
    CV: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Western Africa" },
    CI: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Western Africa" },
    GM: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Western Africa" },
    GH: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Western Africa" },
    GN: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Western Africa" },
    GW: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Western Africa" },
    LR: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Western Africa" },
    ML: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Western Africa" },
    MR: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Western Africa" },
    NE: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Western Africa" },
    NG: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Western Africa" },
    SH: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Western Africa" }, // Saint Helena
    SN: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Western Africa" },
    SL: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Western Africa" },
    TG: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Western Africa" },

    // Americas - Caribbean (Latin America and the Caribbean / North America)
    AI: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    AG: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    AW: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    BS: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    BB: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    BQ: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" }, // Caribbean Netherlands
    VG: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    KY: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    CU: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    CW: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    DM: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    DO: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    GD: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    GP: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    HT: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    JM: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    MQ: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    MS: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    PR: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    BL: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" }, // Saint Barthélemy
    KN: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    LC: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    MF: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" }, // Saint Martin
    VC: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    SX: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    TT: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    TC: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    VI: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },

    // Americas - Central America (Latin America and the Caribbean)
    BZ: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Central America" },
    CR: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Central America" },
    SV: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Central America" },
    GT: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Central America" },
    HN: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Central America" },
    MX: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Central America" },
    NI: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Central America" },
    PA: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Central America" },

    // Americas - South America (Latin America and the Caribbean)
    AR: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "South America" },
    BO: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "South America" },
    BV: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "South America" }, // Bouvet Island
    BR: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "South America" },
    CL: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "South America" },
    CO: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "South America" },
    EC: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "South America" },
    FK: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "South America" },
    GF: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "South America" }, // French Guiana
    GY: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "South America" },
    PY: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "South America" },
    PE: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "South America" },
    GS: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "South America" }, // South Georgia
    SR: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "South America" },
    UY: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "South America" },
    VE: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "South America" },

    // Americas - Northern America (North America)
    BM: { continent: "Americas", intermediary: "North America", subregion: "Northern America" },
    CA: { continent: "Americas", intermediary: "North America", subregion: "Northern America" },
    GL: { continent: "Americas", intermediary: "North America", subregion: "Northern America" },
    PM: { continent: "Americas", intermediary: "North America", subregion: "Northern America" }, // Saint Pierre and Miquelon
    US: { continent: "Americas", intermediary: "North America", subregion: "Northern America" },

    // Antarctica
    AQ: { continent: "Antarctica", subregion: "Antarctica" },

    // Asia - Central Asia
    KZ: { continent: "Asia", subregion: "Central Asia" },
    KG: { continent: "Asia", subregion: "Central Asia" },
    TJ: { continent: "Asia", subregion: "Central Asia" },
    TM: { continent: "Asia", subregion: "Central Asia" },
    UZ: { continent: "Asia", subregion: "Central Asia" },

    // Asia - Eastern Asia
    CN: { continent: "Asia", subregion: "Eastern Asia" },
    HK: { continent: "Asia", subregion: "Eastern Asia" },
    MO: { continent: "Asia", subregion: "Eastern Asia" },
    KP: { continent: "Asia", subregion: "Eastern Asia" },
    JP: { continent: "Asia", subregion: "Eastern Asia" },
    MN: { continent: "Asia", subregion: "Eastern Asia" },
    KR: { continent: "Asia", subregion: "Eastern Asia" },

    // Asia - South-eastern Asia
    BN: { continent: "Asia", subregion: "South-eastern Asia" },
    KH: { continent: "Asia", subregion: "South-eastern Asia" },
    ID: { continent: "Asia", subregion: "South-eastern Asia" },
    LA: { continent: "Asia", subregion: "South-eastern Asia" },
    MY: { continent: "Asia", subregion: "South-eastern Asia" },
    MM: { continent: "Asia", subregion: "South-eastern Asia" },
    PH: { continent: "Asia", subregion: "South-eastern Asia" },
    SG: { continent: "Asia", subregion: "South-eastern Asia" },
    TH: { continent: "Asia", subregion: "South-eastern Asia" },
    TL: { continent: "Asia", subregion: "South-eastern Asia" },
    VN: { continent: "Asia", subregion: "South-eastern Asia" },

    // Asia - Southern Asia
    AF: { continent: "Asia", subregion: "Southern Asia" },
    BD: { continent: "Asia", subregion: "Southern Asia" },
    BT: { continent: "Asia", subregion: "Southern Asia" },
    IN: { continent: "Asia", subregion: "Southern Asia" },
    IR: { continent: "Asia", subregion: "Southern Asia" },
    MV: { continent: "Asia", subregion: "Southern Asia" },
    NP: { continent: "Asia", subregion: "Southern Asia" },
    PK: { continent: "Asia", subregion: "Southern Asia" },
    LK: { continent: "Asia", subregion: "Southern Asia" },

    // Asia - Western Asia
    AM: { continent: "Asia", subregion: "Western Asia" },
    AZ: { continent: "Asia", subregion: "Western Asia" },
    BH: { continent: "Asia", subregion: "Western Asia" },
    CY: { continent: "Asia", subregion: "Western Asia" },
    GE: { continent: "Asia", subregion: "Western Asia" },
    IQ: { continent: "Asia", subregion: "Western Asia" },
    IL: { continent: "Asia", subregion: "Western Asia" },
    JO: { continent: "Asia", subregion: "Western Asia" },
    KW: { continent: "Asia", subregion: "Western Asia" },
    LB: { continent: "Asia", subregion: "Western Asia" },
    OM: { continent: "Asia", subregion: "Western Asia" },
    QA: { continent: "Asia", subregion: "Western Asia" },
    SA: { continent: "Asia", subregion: "Western Asia" },
    PS: { continent: "Asia", subregion: "Western Asia" },
    SY: { continent: "Asia", subregion: "Western Asia" },
    TR: { continent: "Asia", subregion: "Western Asia" },
    AE: { continent: "Asia", subregion: "Western Asia" },
    YE: { continent: "Asia", subregion: "Western Asia" },

    // Europe - Eastern Europe
    BY: { continent: "Europe", subregion: "Eastern Europe" },
    BG: { continent: "Europe", subregion: "Eastern Europe" },
    CZ: { continent: "Europe", subregion: "Eastern Europe" },
    HU: { continent: "Europe", subregion: "Eastern Europe" },
    PL: { continent: "Europe", subregion: "Eastern Europe" },
    MD: { continent: "Europe", subregion: "Eastern Europe" },
    RO: { continent: "Europe", subregion: "Eastern Europe" },
    RU: { continent: "Europe", subregion: "Eastern Europe" },
    SK: { continent: "Europe", subregion: "Eastern Europe" },
    UA: { continent: "Europe", subregion: "Eastern Europe" },

    // Europe - Northern Europe
    AX: { continent: "Europe", subregion: "Northern Europe" }, // Åland Islands
    DK: { continent: "Europe", subregion: "Northern Europe" },
    EE: { continent: "Europe", subregion: "Northern Europe" },
    FO: { continent: "Europe", subregion: "Northern Europe" },
    FI: { continent: "Europe", subregion: "Northern Europe" },
    GG: { continent: "Europe", subregion: "Northern Europe" }, // Guernsey
    IS: { continent: "Europe", subregion: "Northern Europe" },
    IE: { continent: "Europe", subregion: "Northern Europe" },
    IM: { continent: "Europe", subregion: "Northern Europe" }, // Isle of Man
    JE: { continent: "Europe", subregion: "Northern Europe" }, // Jersey
    LV: { continent: "Europe", subregion: "Northern Europe" },
    LT: { continent: "Europe", subregion: "Northern Europe" },
    NO: { continent: "Europe", subregion: "Northern Europe" },
    SJ: { continent: "Europe", subregion: "Northern Europe" }, // Svalbard and Jan Mayen
    SE: { continent: "Europe", subregion: "Northern Europe" },
    GB: { continent: "Europe", subregion: "Northern Europe" },

    // Europe - Southern Europe
    AL: { continent: "Europe", subregion: "Southern Europe" },
    AD: { continent: "Europe", subregion: "Southern Europe" },
    BA: { continent: "Europe", subregion: "Southern Europe" },
    HR: { continent: "Europe", subregion: "Southern Europe" },
    GI: { continent: "Europe", subregion: "Southern Europe" },
    GR: { continent: "Europe", subregion: "Southern Europe" },
    VA: { continent: "Europe", subregion: "Southern Europe" },
    IT: { continent: "Europe", subregion: "Southern Europe" },
    MT: { continent: "Europe", subregion: "Southern Europe" },
    ME: { continent: "Europe", subregion: "Southern Europe" },
    MK: { continent: "Europe", subregion: "Southern Europe" },
    PT: { continent: "Europe", subregion: "Southern Europe" },
    SM: { continent: "Europe", subregion: "Southern Europe" },
    RS: { continent: "Europe", subregion: "Southern Europe" },
    SI: { continent: "Europe", subregion: "Southern Europe" },
    ES: { continent: "Europe", subregion: "Southern Europe" },

    // Europe - Western Europe
    AT: { continent: "Europe", subregion: "Western Europe" },
    BE: { continent: "Europe", subregion: "Western Europe" },
    FR: { continent: "Europe", subregion: "Western Europe" },
    DE: { continent: "Europe", subregion: "Western Europe" },
    LI: { continent: "Europe", subregion: "Western Europe" },
    LU: { continent: "Europe", subregion: "Western Europe" },
    MC: { continent: "Europe", subregion: "Western Europe" },
    NL: { continent: "Europe", subregion: "Western Europe" },
    CH: { continent: "Europe", subregion: "Western Europe" },

    // Oceania - Australia and New Zealand
    AU: { continent: "Oceania", subregion: "Australia and New Zealand" },
    CX: { continent: "Oceania", subregion: "Australia and New Zealand" }, // Christmas Island
    CC: { continent: "Oceania", subregion: "Australia and New Zealand" }, // Cocos Islands
    HM: { continent: "Oceania", subregion: "Australia and New Zealand" },
    NZ: { continent: "Oceania", subregion: "Australia and New Zealand" },
    NF: { continent: "Oceania", subregion: "Australia and New Zealand" }, // Norfolk Island

    // Oceania - Melanesia
    FJ: { continent: "Oceania", subregion: "Melanesia" },
    NC: { continent: "Oceania", subregion: "Melanesia" },
    PG: { continent: "Oceania", subregion: "Melanesia" },
    SB: { continent: "Oceania", subregion: "Melanesia" },
    VU: { continent: "Oceania", subregion: "Melanesia" },

    // Oceania - Micronesia
    GU: { continent: "Oceania", subregion: "Micronesia" },
    KI: { continent: "Oceania", subregion: "Micronesia" },
    MH: { continent: "Oceania", subregion: "Micronesia" },
    FM: { continent: "Oceania", subregion: "Micronesia" },
    NR: { continent: "Oceania", subregion: "Micronesia" },
    MP: { continent: "Oceania", subregion: "Micronesia" },
    PW: { continent: "Oceania", subregion: "Micronesia" },
    UM: { continent: "Oceania", subregion: "Micronesia" }, // US Minor Outlying Islands

    // Oceania - Polynesia
    AS: { continent: "Oceania", subregion: "Polynesia" },
    CK: { continent: "Oceania", subregion: "Polynesia" },
    PF: { continent: "Oceania", subregion: "Polynesia" }, // French Polynesia
    NU: { continent: "Oceania", subregion: "Polynesia" },
    PN: { continent: "Oceania", subregion: "Polynesia" },
    WS: { continent: "Oceania", subregion: "Polynesia" },
    TK: { continent: "Oceania", subregion: "Polynesia" },
    TO: { continent: "Oceania", subregion: "Polynesia" },
    TV: { continent: "Oceania", subregion: "Polynesia" },
    WF: { continent: "Oceania", subregion: "Polynesia" }, // Wallis and Futuna
} as const;

export default countryRegions;
