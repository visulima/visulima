/**
 * Country to region mapping based on UN geoscheme
 * Maps ISO 3166-1 alpha-2 country codes to their UN geoscheme regions
 *
 * Declared without a type annotation so the trailing `as const` captures the
 * literal keys/values; consumers in `src/regions.ts` derive precise unions from this.
 */
const countryRegions = {
    AD: { continent: "Europe", subregion: "Southern Europe" },
    AE: { continent: "Asia", subregion: "Western Asia" },
    // Asia - Southern Asia
    AF: { continent: "Asia", subregion: "Southern Asia" },
    AG: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    // Americas - Caribbean (Latin America and the Caribbean / North America)
    AI: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    // Europe - Southern Europe
    AL: { continent: "Europe", subregion: "Southern Europe" },
    // Asia - Western Asia
    AM: { continent: "Asia", subregion: "Western Asia" },

    // Africa - Middle Africa (Sub-Saharan Africa)
    AO: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Middle Africa" },
    // Antarctica
    AQ: { continent: "Antarctica", subregion: "Antarctica" },
    // Americas - South America (Latin America and the Caribbean)
    AR: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "South America" },
    // Oceania - Polynesia
    AS: { continent: "Oceania", subregion: "Polynesia" },
    // Europe - Western Europe
    AT: { continent: "Europe", subregion: "Western Europe" },
    // Oceania - Australia and New Zealand
    AU: { continent: "Oceania", subregion: "Australia and New Zealand" },
    AW: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    // Europe - Northern Europe
    AX: { continent: "Europe", subregion: "Northern Europe" }, // Åland Islands
    AZ: { continent: "Asia", subregion: "Western Asia" },
    BA: { continent: "Europe", subregion: "Southern Europe" },
    BB: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    BD: { continent: "Asia", subregion: "Southern Asia" },
    BE: { continent: "Europe", subregion: "Western Europe" },
    BF: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Western Africa" },
    BG: { continent: "Europe", subregion: "Eastern Europe" },
    BH: { continent: "Asia", subregion: "Western Asia" },
    BI: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" },
    // Africa - Western Africa (Sub-Saharan Africa)
    BJ: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Western Africa" },
    BL: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" }, // Saint Barthélemy
    // Americas - Northern America (North America)
    BM: { continent: "Americas", intermediary: "North America", subregion: "Northern America" },
    // Asia - South-eastern Asia
    BN: { continent: "Asia", subregion: "South-eastern Asia" },
    BO: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "South America" },

    BQ: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" }, // Caribbean Netherlands
    BR: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "South America" },
    BS: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    BT: { continent: "Asia", subregion: "Southern Asia" },
    BV: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "South America" }, // Bouvet Island
    // Africa - Southern Africa (Sub-Saharan Africa)
    BW: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Southern Africa" },
    // Europe - Eastern Europe
    BY: { continent: "Europe", subregion: "Eastern Europe" },
    // Americas - Central America (Latin America and the Caribbean)
    BZ: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Central America" },
    CA: { continent: "Americas", intermediary: "North America", subregion: "Northern America" },

    CC: { continent: "Oceania", subregion: "Australia and New Zealand" }, // Cocos Islands
    CD: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Middle Africa" },
    CF: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Middle Africa" },
    CG: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Middle Africa" },
    CH: { continent: "Europe", subregion: "Western Europe" },

    CI: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Western Africa" },
    CK: { continent: "Oceania", subregion: "Polynesia" },
    CL: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "South America" },
    CM: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Middle Africa" },
    // Asia - Eastern Asia
    CN: { continent: "Asia", subregion: "Eastern Asia" },
    CO: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "South America" },
    CR: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Central America" },
    CU: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    CV: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Western Africa" },
    CW: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    CX: { continent: "Oceania", subregion: "Australia and New Zealand" }, // Christmas Island
    CY: { continent: "Asia", subregion: "Western Asia" },
    CZ: { continent: "Europe", subregion: "Eastern Europe" },
    DE: { continent: "Europe", subregion: "Western Europe" },
    DJ: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" },
    DK: { continent: "Europe", subregion: "Northern Europe" },
    DM: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },

    DO: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    // Africa - Northern Africa
    DZ: { continent: "Africa", subregion: "Northern Africa" },
    EC: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "South America" },
    EE: { continent: "Europe", subregion: "Northern Europe" },
    EG: { continent: "Africa", subregion: "Northern Africa" },
    EH: { continent: "Africa", subregion: "Northern Africa" }, // Western Sahara
    ER: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" },
    ES: { continent: "Europe", subregion: "Southern Europe" },
    ET: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" },
    FI: { continent: "Europe", subregion: "Northern Europe" },
    // Oceania - Melanesia
    FJ: { continent: "Oceania", subregion: "Melanesia" },
    FK: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "South America" },
    FM: { continent: "Oceania", subregion: "Micronesia" },
    FO: { continent: "Europe", subregion: "Northern Europe" },
    FR: { continent: "Europe", subregion: "Western Europe" },
    GA: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Middle Africa" },
    GB: { continent: "Europe", subregion: "Northern Europe" },
    GD: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    GE: { continent: "Asia", subregion: "Western Asia" },
    GF: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "South America" }, // French Guiana
    GG: { continent: "Europe", subregion: "Northern Europe" }, // Guernsey
    GH: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Western Africa" },
    GI: { continent: "Europe", subregion: "Southern Europe" },
    GL: { continent: "Americas", intermediary: "North America", subregion: "Northern America" },
    GM: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Western Africa" },
    GN: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Western Africa" },
    GP: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    GQ: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Middle Africa" },

    GR: { continent: "Europe", subregion: "Southern Europe" },
    GS: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "South America" }, // South Georgia
    GT: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Central America" },
    // Oceania - Micronesia
    GU: { continent: "Oceania", subregion: "Micronesia" },
    GW: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Western Africa" },
    GY: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "South America" },
    HK: { continent: "Asia", subregion: "Eastern Asia" },
    HM: { continent: "Oceania", subregion: "Australia and New Zealand" },

    HN: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Central America" },
    HR: { continent: "Europe", subregion: "Southern Europe" },
    HT: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    HU: { continent: "Europe", subregion: "Eastern Europe" },
    ID: { continent: "Asia", subregion: "South-eastern Asia" },
    IE: { continent: "Europe", subregion: "Northern Europe" },
    IL: { continent: "Asia", subregion: "Western Asia" },
    IM: { continent: "Europe", subregion: "Northern Europe" }, // Isle of Man
    IN: { continent: "Asia", subregion: "Southern Asia" },
    // Africa - Eastern Africa (Sub-Saharan Africa)
    IO: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" }, // British Indian Ocean Territory
    IQ: { continent: "Asia", subregion: "Western Asia" },
    IR: { continent: "Asia", subregion: "Southern Asia" },
    IS: { continent: "Europe", subregion: "Northern Europe" },
    IT: { continent: "Europe", subregion: "Southern Europe" },
    JE: { continent: "Europe", subregion: "Northern Europe" }, // Jersey
    JM: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },

    JO: { continent: "Asia", subregion: "Western Asia" },
    JP: { continent: "Asia", subregion: "Eastern Asia" },
    KE: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" },
    KG: { continent: "Asia", subregion: "Central Asia" },
    KH: { continent: "Asia", subregion: "South-eastern Asia" },

    KI: { continent: "Oceania", subregion: "Micronesia" },

    KM: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" },
    KN: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    KP: { continent: "Asia", subregion: "Eastern Asia" },
    KR: { continent: "Asia", subregion: "Eastern Asia" },
    KW: { continent: "Asia", subregion: "Western Asia" },

    KY: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    // Asia - Central Asia
    KZ: { continent: "Asia", subregion: "Central Asia" },
    LA: { continent: "Asia", subregion: "South-eastern Asia" },
    LB: { continent: "Asia", subregion: "Western Asia" },
    LC: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    LI: { continent: "Europe", subregion: "Western Europe" },
    LK: { continent: "Asia", subregion: "Southern Asia" },

    LR: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Western Africa" },
    LS: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Southern Africa" },
    LT: { continent: "Europe", subregion: "Northern Europe" },
    LU: { continent: "Europe", subregion: "Western Europe" },
    LV: { continent: "Europe", subregion: "Northern Europe" },
    LY: { continent: "Africa", subregion: "Northern Africa" },
    MA: { continent: "Africa", subregion: "Northern Africa" },
    MC: { continent: "Europe", subregion: "Western Europe" },
    MD: { continent: "Europe", subregion: "Eastern Europe" },
    ME: { continent: "Europe", subregion: "Southern Europe" },
    MF: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" }, // Saint Martin

    MG: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" },
    MH: { continent: "Oceania", subregion: "Micronesia" },
    MK: { continent: "Europe", subregion: "Southern Europe" },
    ML: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Western Africa" },
    MM: { continent: "Asia", subregion: "South-eastern Asia" },
    MN: { continent: "Asia", subregion: "Eastern Asia" },
    MO: { continent: "Asia", subregion: "Eastern Asia" },
    MP: { continent: "Oceania", subregion: "Micronesia" },
    MQ: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },

    MR: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Western Africa" },
    MS: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    MT: { continent: "Europe", subregion: "Southern Europe" },
    MU: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" },
    MV: { continent: "Asia", subregion: "Southern Asia" },
    MW: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" },
    MX: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Central America" },
    MY: { continent: "Asia", subregion: "South-eastern Asia" },
    MZ: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" },
    NA: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Southern Africa" },
    NC: { continent: "Oceania", subregion: "Melanesia" },
    NE: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Western Africa" },
    NF: { continent: "Oceania", subregion: "Australia and New Zealand" }, // Norfolk Island
    NG: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Western Africa" },
    NI: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Central America" },
    NL: { continent: "Europe", subregion: "Western Europe" },
    NO: { continent: "Europe", subregion: "Northern Europe" },
    NP: { continent: "Asia", subregion: "Southern Asia" },

    NR: { continent: "Oceania", subregion: "Micronesia" },
    NU: { continent: "Oceania", subregion: "Polynesia" },
    NZ: { continent: "Oceania", subregion: "Australia and New Zealand" },
    OM: { continent: "Asia", subregion: "Western Asia" },
    PA: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Central America" },
    PE: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "South America" },
    PF: { continent: "Oceania", subregion: "Polynesia" }, // French Polynesia
    PG: { continent: "Oceania", subregion: "Melanesia" },
    PH: { continent: "Asia", subregion: "South-eastern Asia" },
    PK: { continent: "Asia", subregion: "Southern Asia" },

    PL: { continent: "Europe", subregion: "Eastern Europe" },
    PM: { continent: "Americas", intermediary: "North America", subregion: "Northern America" }, // Saint Pierre and Miquelon
    PN: { continent: "Oceania", subregion: "Polynesia" },
    PR: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    PS: { continent: "Asia", subregion: "Western Asia" },
    PT: { continent: "Europe", subregion: "Southern Europe" },
    PW: { continent: "Oceania", subregion: "Micronesia" },
    PY: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "South America" },
    QA: { continent: "Asia", subregion: "Western Asia" },
    RE: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" }, // Réunion
    RO: { continent: "Europe", subregion: "Eastern Europe" },
    RS: { continent: "Europe", subregion: "Southern Europe" },
    RU: { continent: "Europe", subregion: "Eastern Europe" },
    RW: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" },
    SA: { continent: "Asia", subregion: "Western Asia" },
    SB: { continent: "Oceania", subregion: "Melanesia" },

    SC: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" },
    SD: { continent: "Africa", subregion: "Northern Africa" },
    SE: { continent: "Europe", subregion: "Northern Europe" },
    SG: { continent: "Asia", subregion: "South-eastern Asia" },
    SH: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Western Africa" }, // Saint Helena
    SI: { continent: "Europe", subregion: "Southern Europe" },
    SJ: { continent: "Europe", subregion: "Northern Europe" }, // Svalbard and Jan Mayen
    SK: { continent: "Europe", subregion: "Eastern Europe" },
    SL: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Western Africa" },
    SM: { continent: "Europe", subregion: "Southern Europe" },
    SN: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Western Africa" },
    SO: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" },
    SR: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "South America" },
    SS: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" }, // South Sudan
    ST: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Middle Africa" },
    SV: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Central America" },

    SX: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    SY: { continent: "Asia", subregion: "Western Asia" },
    SZ: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Southern Africa" }, // Eswatini
    TC: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    TD: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Middle Africa" },
    TF: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" }, // French Southern Territories
    TG: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Western Africa" },
    TH: { continent: "Asia", subregion: "South-eastern Asia" },
    TJ: { continent: "Asia", subregion: "Central Asia" },

    TK: { continent: "Oceania", subregion: "Polynesia" },
    TL: { continent: "Asia", subregion: "South-eastern Asia" },
    TM: { continent: "Asia", subregion: "Central Asia" },
    TN: { continent: "Africa", subregion: "Northern Africa" },
    TO: { continent: "Oceania", subregion: "Polynesia" },
    TR: { continent: "Asia", subregion: "Western Asia" },

    TT: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    TV: { continent: "Oceania", subregion: "Polynesia" },
    TZ: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" },
    UA: { continent: "Europe", subregion: "Eastern Europe" },
    UG: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" },

    UM: { continent: "Oceania", subregion: "Micronesia" }, // US Minor Outlying Islands
    US: { continent: "Americas", intermediary: "North America", subregion: "Northern America" },
    UY: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "South America" },
    UZ: { continent: "Asia", subregion: "Central Asia" },
    VA: { continent: "Europe", subregion: "Southern Europe" },
    VC: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    VE: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "South America" },
    VG: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },

    VI: { continent: "Americas", intermediary: "Latin America and the Caribbean", subregion: "Caribbean" },
    VN: { continent: "Asia", subregion: "South-eastern Asia" },
    VU: { continent: "Oceania", subregion: "Melanesia" },
    WF: { continent: "Oceania", subregion: "Polynesia" }, // Wallis and Futuna
    WS: { continent: "Oceania", subregion: "Polynesia" },
    YE: { continent: "Asia", subregion: "Western Asia" },
    YT: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" }, // Mayotte
    ZA: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Southern Africa" },
    ZM: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" },
    ZW: { continent: "Africa", intermediary: "Sub-Saharan Africa", subregion: "Eastern Africa" },
} as const;

export default countryRegions;
