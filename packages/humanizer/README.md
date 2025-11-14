<div align="center">
  <h3>Visulima humanizer</h3>
  <p>
  Humanizer is a library for humanizing data in a human-readable form.
  </p>
</div>

<br />

<div align="center">

[![TypeScript](https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/) [![npm](https://img.shields.io/npm/v/@visulima/humanizer/latest.svg?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@visulima/humanizer/v/latest) [![license](https://img.shields.io/npm/l/@visulima/humanizer?color=blueviolet&style=for-the-badge)](LICENSE.md)

</div>

---

<div align="center">
    <p>
        <sup>
            Daniel Bannert's open source work is supported by the community on <a href="https://github.com/sponsors/prisis">GitHub Sponsors</a>
        </sup>
    </p>
</div>

---

## Install

```sh
npm install @visulima/humanizer
```

```sh
yarn add @visulima/humanizer
```

```sh
pnpm add @visulima/humanizer
```

## Usage

### Bytes

Convert bytes to human-readable strings and vice versa: 1024 → 1KB and 1KB → 1024

```ts
import { formatBytes, parseBytes } from "@visulima/humanizer";

console.log(formatBytes(123412341, { decimals: 2 })); // "117.70 MB"
console.log(parseBytes("117.70 MB")); // 123417395.2

// Localization support in both directions
console.log(formatBytes(123412341, { decimals: 2, locale: "de" })); // "117,70 MB"
console.log(parseBytes("117,70 MB", { locale: "de" })); // 123417395.2

// Use a specified unit
console.log(formatBytes(123412341, { decimals: 2, unit: "KB" })); // "120,519.86 KB"

// Use a long unit
console.log(formatBytes(123412341, { decimals: 2, unit: "GB", long: true })); // "0.11 Gigabytes"

// Use a differnet base
console.log(formatBytes(123412341, { decimals: 2, base: 10 })); // "123.41 MB"
```

#### Supported locales

> Default: "en".

`formatBytes` and `parseBytes` supports the following locales:

<details>
    <summary><strong>Supported locales</strong></summary>
    <ul>
        <li>af-NA"</li>
        <li>af"</li>
        <li>agq"</li>
        <li>ak"</li>
        <li>am"</li>
        <li>ar-AE"</li>
        <li>ar-BH"</li>
        <li>ar-DJ"</li>
        <li>ar-DZ"</li>
        <li>ar-EG"</li>
        <li>ar-EH"</li>
        <li>ar-ER"</li>
        <li>ar-IL"</li>
        <li>ar-IQ"</li>
        <li>ar-JO"</li>
        <li>ar-KM"</li>
        <li>ar-KW"</li>
        <li>ar-LB"</li>
        <li>ar-LY"</li>
        <li>ar-MA"</li>
        <li>ar-MR"</li>
        <li>ar-OM"</li>
        <li>ar-PS"</li>
        <li>ar-QA"</li>
        <li>ar-SA"</li>
        <li>ar-SD"</li>
        <li>ar-SO"</li>
        <li>ar-SS"</li>
        <li>ar-SY"</li>
        <li>ar-TD"</li>
        <li>ar-TN"</li>
        <li>ar-YE"</li>
        <li>ar"</li>
        <li>as"</li>
        <li>asa"</li>
        <li>ast"</li>
        <li>az-Cyrl"</li>
        <li>az-Latn"</li>
        <li>az"</li>
        <li>bas"</li>
        <li>be-tarask"</li>
        <li>be"</li>
        <li>bem"</li>
        <li>bez"</li>
        <li>bg"</li>
        <li>bm"</li>
        <li>bn-IN"</li>
        <li>bn"</li>
        <li>bo-IN"</li>
        <li>bo"</li>
        <li>br"</li>
        <li>brx"</li>
        <li>bs-Cyrl"</li>
        <li>bs-Latn"</li>
        <li>bs"</li>
        <li>ca-AD"</li>
        <li>ca-ES-valencia"</li>
        <li>ca-FR"</li>
        <li>ca-IT"</li>
        <li>ca"</li>
        <li>ccp-IN"</li>
        <li>ccp"</li>
        <li>ce"</li>
        <li>ceb"</li>
        <li>cgg"</li>
        <li>chr"</li>
        <li>ckb-IR"</li>
        <li>ckb"</li>
        <li>cs"</li>
        <li>cy"</li>
        <li>da-GL"</li>
        <li>da"</li>
        <li>dav"</li>
        <li>de-AT"</li>
        <li>de-BE"</li>
        <li>de-CH"</li>
        <li>de-IT"</li>
        <li>de-LI"</li>
        <li>de-LU"</li>
        <li>de"</li>
        <li>dje"</li>
        <li>doi"</li>
        <li>dsb"</li>
        <li>dua"</li>
        <li>dyo"</li>
        <li>dz"</li>
        <li>ebu"</li>
        <li>ee-TG"</li>
        <li>ee"</li>
        <li>el-CY"</li>
        <li>el"</li>
        <li>en-001"</li>
        <li>en-150"</li>
        <li>en-AE"</li>
        <li>en-AG"</li>
        <li>en-AI"</li>
        <li>en-AS"</li>
        <li>en-AT"</li>
        <li>en-AU"</li>
        <li>en-BB"</li>
        <li>en-BE"</li>
        <li>en-BI"</li>
        <li>en-BM"</li>
        <li>en-BS"</li>
        <li>en-BW"</li>
        <li>en-BZ"</li>
        <li>en-CA"</li>
        <li>en-CC"</li>
        <li>en-CH"</li>
        <li>en-CK"</li>
        <li>en-CM"</li>
        <li>en-CX"</li>
        <li>en-CY"</li>
        <li>en-DE"</li>
        <li>en-DG"</li>
        <li>en-DK"</li>
        <li>en-DM"</li>
        <li>en-ER"</li>
        <li>en-FI"</li>
        <li>en-FJ"</li>
        <li>en-FK"</li>
        <li>en-FM"</li>
        <li>en-GB"</li>
        <li>en-GD"</li>
        <li>en-GG"</li>
        <li>en-GH"</li>
        <li>en-GI"</li>
        <li>en-GM"</li>
        <li>en-GU"</li>
        <li>en-GY"</li>
        <li>en-HK"</li>
        <li>en-IE"</li>
        <li>en-IL"</li>
        <li>en-IM"</li>
        <li>en-IN"</li>
        <li>en-IO"</li>
        <li>en-JE"</li>
        <li>en-JM"</li>
        <li>en-KE"</li>
        <li>en-KI"</li>
        <li>en-KN"</li>
        <li>en-KY"</li>
        <li>en-LC"</li>
        <li>en-LR"</li>
        <li>en-LS"</li>
        <li>en-MG"</li>
        <li>en-MH"</li>
        <li>en-MO"</li>
        <li>en-MP"</li>
        <li>en-MS"</li>
        <li>en-MT"</li>
        <li>en-MU"</li>
        <li>en-MW"</li>
        <li>en-MY"</li>
        <li>en-NA"</li>
        <li>en-NF"</li>
        <li>en-NG"</li>
        <li>en-NL"</li>
        <li>en-NR"</li>
        <li>en-NU"</li>
        <li>en-NZ"</li>
        <li>en-PG"</li>
        <li>en-PH"</li>
        <li>en-PK"</li>
        <li>en-PN"</li>
        <li>en-PR"</li>
        <li>en-PW"</li>
        <li>en-RW"</li>
        <li>en-SB"</li>
        <li>en-SC"</li>
        <li>en-SD"</li>
        <li>en-SE"</li>
        <li>en-SG"</li>
        <li>en-SH"</li>
        <li>en-SI"</li>
        <li>en-SL"</li>
        <li>en-SS"</li>
        <li>en-SX"</li>
        <li>en-SZ"</li>
        <li>en-TC"</li>
        <li>en-TK"</li>
        <li>en-TO"</li>
        <li>en-TT"</li>
        <li>en-TV"</li>
        <li>en-TZ"</li>
        <li>en-UG"</li>
        <li>en-UM"</li>
        <li>en-VC"</li>
        <li>en-VG"</li>
        <li>en-VI"</li>
        <li>en-VU"</li>
        <li>en-WS"</li>
        <li>en-ZA"</li>
        <li>en-ZM"</li>
        <li>en-ZW"</li>
        <li>en"</li>
        <li>eo"</li>
        <li>es-419"</li>
        <li>es-AR"</li>
        <li>es-BO"</li>
        <li>es-BR"</li>
        <li>es-BZ"</li>
        <li>es-CL"</li>
        <li>es-CO"</li>
        <li>es-CR"</li>
        <li>es-CU"</li>
        <li>es-DO"</li>
        <li>es-EA"</li>
        <li>es-EC"</li>
        <li>es-GQ"</li>
        <li>es-GT"</li>
        <li>es-HN"</li>
        <li>es-IC"</li>
        <li>es-MX"</li>
        <li>es-NI"</li>
        <li>es-PA"</li>
        <li>es-PE"</li>
        <li>es-PH"</li>
        <li>es-PR"</li>
        <li>es-PY"</li>
        <li>es-SV"</li>
        <li>es-US"</li>
        <li>es-UY"</li>
        <li>es-VE"</li>
        <li>es"</li>
        <li>et"</li>
        <li>eu"</li>
        <li>ewo"</li>
        <li>fa-AF"</li>
        <li>fa"</li>
        <li>ff-Adlm-BF"</li>
        <li>ff-Adlm-CM"</li>
        <li>ff-Adlm-GH"</li>
        <li>ff-Adlm-GM"</li>
        <li>ff-Adlm-GW"</li>
        <li>ff-Adlm-LR"</li>
        <li>ff-Adlm-MR"</li>
        <li>ff-Adlm-NE"</li>
        <li>ff-Adlm-NG"</li>
        <li>ff-Adlm-SL"</li>
        <li>ff-Adlm-SN"</li>
        <li>ff-Adlm"</li>
        <li>ff-Latn-BF"</li>
        <li>ff-Latn-CM"</li>
        <li>ff-Latn-GH"</li>
        <li>ff-Latn-GM"</li>
        <li>ff-Latn-GN"</li>
        <li>ff-Latn-GW"</li>
        <li>ff-Latn-LR"</li>
        <li>ff-Latn-MR"</li>
        <li>ff-Latn-NE"</li>
        <li>ff-Latn-NG"</li>
        <li>ff-Latn-SL"</li>
        <li>ff-Latn"</li>
        <li>ff"</li>
        <li>fi"</li>
        <li>fil"</li>
        <li>fo-DK"</li>
        <li>fo"</li>
        <li>fr-BE"</li>
        <li>fr-BF"</li>
        <li>fr-BI"</li>
        <li>fr-BJ"</li>
        <li>fr-BL"</li>
        <li>fr-CA"</li>
        <li>fr-CD"</li>
        <li>fr-CF"</li>
        <li>fr-CG"</li>
        <li>fr-CH"</li>
        <li>fr-CI"</li>
        <li>fr-CM"</li>
        <li>fr-DJ"</li>
        <li>fr-DZ"</li>
        <li>fr-GA"</li>
        <li>fr-GF"</li>
        <li>fr-GN"</li>
        <li>fr-GP"</li>
        <li>fr-GQ"</li>
        <li>fr-HT"</li>
        <li>fr-KM"</li>
        <li>fr-LU"</li>
        <li>fr-MA"</li>
        <li>fr-MC"</li>
        <li>fr-MF"</li>
        <li>fr-MG"</li>
        <li>fr-ML"</li>
        <li>fr-MQ"</li>
        <li>fr-MR"</li>
        <li>fr-MU"</li>
        <li>fr-NC"</li>
        <li>fr-NE"</li>
        <li>fr-PF"</li>
        <li>fr-PM"</li>
        <li>fr-RE"</li>
        <li>fr-RW"</li>
        <li>fr-SC"</li>
        <li>fr-SN"</li>
        <li>fr-SY"</li>
        <li>fr-TD"</li>
        <li>fr-TG"</li>
        <li>fr-TN"</li>
        <li>fr-VU"</li>
        <li>fr-WF"</li>
        <li>fr-YT"</li>
        <li>fr"</li>
        <li>fur"</li>
        <li>fy"</li>
        <li>ga-GB"</li>
        <li>ga"</li>
        <li>gd"</li>
        <li>gl"</li>
        <li>gsw-FR"</li>
        <li>gsw-LI"</li>
        <li>gsw"</li>
        <li>gu"</li>
        <li>guz"</li>
        <li>gv"</li>
        <li>ha-GH"</li>
        <li>ha-NE"</li>
        <li>ha"</li>
        <li>haw"</li>
        <li>he"</li>
        <li>hi"</li>
        <li>hr-BA"</li>
        <li>hr"</li>
        <li>hsb"</li>
        <li>hu"</li>
        <li>hy"</li>
        <li>ia"</li>
        <li>id"</li>
        <li>ig"</li>
        <li>ii"</li>
        <li>is"</li>
        <li>it-CH"</li>
        <li>it-SM"</li>
        <li>it-VA"</li>
        <li>it"</li>
        <li>ja"</li>
        <li>jgo"</li>
        <li>jmc"</li>
        <li>jv"</li>
        <li>ka"</li>
        <li>kab"</li>
        <li>kam"</li>
        <li>kde"</li>
        <li>kea"</li>
        <li>kgp"</li>
        <li>khq"</li>
        <li>ki"</li>
        <li>kk"</li>
        <li>kkj"</li>
        <li>kl"</li>
        <li>kln"</li>
        <li>km"</li>
        <li>kn"</li>
        <li>ko-KP"</li>
        <li>ko"</li>
        <li>kok"</li>
        <li>ks-Arab"</li>
        <li>ks"</li>
        <li>ksb"</li>
        <li>ksf"</li>
        <li>ksh"</li>
        <li>ku"</li>
        <li>kw"</li>
        <li>ky"</li>
        <li>lag"</li>
        <li>lb"</li>
        <li>lg"</li>
        <li>lkt"</li>
        <li>ln-AO"</li>
        <li>ln-CF"</li>
        <li>ln-CG"</li>
        <li>ln"</li>
        <li>lo"</li>
        <li>lrc-IQ"</li>
        <li>lrc"</li>
        <li>lt"</li>
        <li>lu"</li>
        <li>luo"</li>
        <li>luy"</li>
        <li>lv"</li>
        <li>mai"</li>
        <li>mas-TZ"</li>
        <li>mas"</li>
        <li>mer"</li>
        <li>mfe"</li>
        <li>mg"</li>
        <li>mgh"</li>
        <li>mgo"</li>
        <li>mi"</li>
        <li>mk"</li>
        <li>ml"</li>
        <li>mn"</li>
        <li>mni-Beng"</li>
        <li>mni"</li>
        <li>mr"</li>
        <li>ms-BN"</li>
        <li>ms-ID"</li>
        <li>ms-SG"</li>
        <li>ms"</li>
        <li>mt"</li>
        <li>mua"</li>
        <li>my"</li>
        <li>mzn"</li>
        <li>naq"</li>
        <li>nb-SJ"</li>
        <li>nb"</li>
        <li>nd"</li>
        <li>nds-NL"</li>
        <li>nds"</li>
        <li>ne-IN"</li>
        <li>ne"</li>
        <li>nl-AW"</li>
        <li>nl-BE"</li>
        <li>nl-BQ"</li>
        <li>nl-CW"</li>
        <li>nl-SR"</li>
        <li>nl-SX"</li>
        <li>nl"</li>
        <li>nmg"</li>
        <li>nn"</li>
        <li>nnh"</li>
        <li>no"</li>
        <li>nus"</li>
        <li>nyn"</li>
        <li>om-KE"</li>
        <li>om"</li>
        <li>or"</li>
        <li>os-RU"</li>
        <li>os"</li>
        <li>pa-Arab"</li>
        <li>pa-Guru"</li>
        <li>pa"</li>
        <li>pcm"</li>
        <li>pl"</li>
        <li>ps-PK"</li>
        <li>ps"</li>
        <li>pt-AO"</li>
        <li>pt-CH"</li>
        <li>pt-CV"</li>
        <li>pt-GQ"</li>
        <li>pt-GW"</li>
        <li>pt-LU"</li>
        <li>pt-MO"</li>
        <li>pt-MZ"</li>
        <li>pt-PT"</li>
        <li>pt-ST"</li>
        <li>pt-TL"</li>
        <li>pt"</li>
        <li>qu-BO"</li>
        <li>qu-EC"</li>
        <li>qu"</li>
        <li>rm"</li>
        <li>rn"</li>
        <li>ro-MD"</li>
        <li>ro"</li>
        <li>rof"</li>
        <li>ru-BY"</li>
        <li>ru-KG"</li>
        <li>ru-KZ"</li>
        <li>ru-MD"</li>
        <li>ru-UA"</li>
        <li>ru"</li>
        <li>rw"</li>
        <li>rwk"</li>
        <li>sa"</li>
        <li>sah"</li>
        <li>saq"</li>
        <li>sat-Olck"</li>
        <li>sat"</li>
        <li>sbp"</li>
        <li>sc"</li>
        <li>sd-Arab"</li>
        <li>sd-Deva"</li>
        <li>sd"</li>
        <li>se-FI"</li>
        <li>se-SE"</li>
        <li>se"</li>
        <li>seh"</li>
        <li>ses"</li>
        <li>sg"</li>
        <li>shi-Latn"</li>
        <li>shi-Tfng"</li>
        <li>shi"</li>
        <li>si"</li>
        <li>sk"</li>
        <li>sl"</li>
        <li>smn"</li>
        <li>sn"</li>
        <li>so-DJ"</li>
        <li>so-ET"</li>
        <li>so-KE"</li>
        <li>so"</li>
        <li>sq-MK"</li>
        <li>sq-XK"</li>
        <li>sq"</li>
        <li>sr-Cyrl-BA"</li>
        <li>sr-Cyrl-ME"</li>
        <li>sr-Cyrl-XK"</li>
        <li>sr-Cyrl"</li>
        <li>sr-Latn-BA"</li>
        <li>sr-Latn-ME"</li>
        <li>sr-Latn-XK"</li>
        <li>sr-Latn"</li>
        <li>sr"</li>
        <li>su-Latn"</li>
        <li>su"</li>
        <li>sv-AX"</li>
        <li>sv-FI"</li>
        <li>sv"</li>
        <li>sw-CD"</li>
        <li>sw-KE"</li>
        <li>sw-UG"</li>
        <li>sw"</li>
        <li>ta-LK"</li>
        <li>ta-MY"</li>
        <li>ta-SG"</li>
        <li>ta"</li>
        <li>te"</li>
        <li>teo-KE"</li>
        <li>teo"</li>
        <li>tg"</li>
        <li>th"</li>
        <li>ti-ER"</li>
        <li>ti"</li>
        <li>tk"</li>
        <li>to"</li>
        <li>tr-CY"</li>
        <li>tr"</li>
        <li>tt"</li>
        <li>twq"</li>
        <li>tzm"</li>
        <li>ug"</li>
        <li>uk"</li>
        <li>und"</li>
        <li>ur-IN"</li>
        <li>ur"</li>
        <li>uz-Arab"</li>
        <li>uz-Cyrl"</li>
        <li>uz-Latn"</li>
        <li>uz"</li>
        <li>vai-Latn"</li>
        <li>vai-Vaii"</li>
        <li>vai"</li>
        <li>vi"</li>
        <li>vun"</li>
        <li>wae"</li>
        <li>wo"</li>
        <li>xh"</li>
        <li>xog"</li>
        <li>yav"</li>
        <li>yi"</li>
        <li>yo-BJ"</li>
        <li>yo"</li>
        <li>yrl-CO"</li>
        <li>yrl-VE"</li>
        <li>yrl"</li>
        <li>yue-Hans"</li>
        <li>yue-Hant"</li>
        <li>yue"</li>
        <li>zgh"</li>
        <li>zh-Hans-HK"</li>
        <li>zh-Hans-MO"</li>
        <li>zh-Hans-SG"</li>
        <li>zh-Hans"</li>
        <li>zh-Hant-HK"</li>
        <li>zh-Hant-MO"</li>
        <li>zh-Hant"</li>
        <li>zh"</li>
        <li>zu"</li>
    </ul>
</details>

### Duration

> `duration` and `parseDuration` functionality is based on a modified version of [HumanizeDuration](https://github.com/EvanHahn/HumanizeDuration.js).

Format time in milliseconds into a human-readable string like "30 minutes" or "3 days, 1 hour". Parse various human-readable duration strings back into milliseconds.

```ts
import { duration, parseDuration } from "@visulima/humanizer";
import { durationLanguage as fr } from "@visulima/humanizer/language/fr"; // Example language import

// --- Formatting ---
console.log(duration(3000));
// => "3 seconds"

console.log(duration(2250));
// => "2.25 seconds"

console.log(duration(97320000));
// => "1 day, 3 hours, 2 minutes"

// --- Parsing ---
console.log(parseDuration("1 day, 3 hours, 2 minutes"));
// => 97320000

console.log(parseDuration("2h 30 min"));
// => 9000000

console.log(parseDuration("-3 weeks"));
// => -1814400000

console.log(parseDuration("1.5 years"));
// => 47335428000

// Parsing with different languages (requires language object with unitMap)
console.log(parseDuration("2 jours et 5 heures", { language: fr }));
// => 190800000

// Parsing colon format (H:MM:SS or MM:SS)
console.log(parseDuration("1:25:05"));
// => 5105000

console.log(parseDuration("15:30"));
// => 930000

// Parsing ISO 8601 duration format (PT#H#M#S)
console.log(parseDuration("PT2H30M5S"));
// => 9005000

// Parsing just numbers (uses defaultUnit)
console.log(parseDuration("1500")); // Default unit is 'ms'
// => 1500
```

#### Options for `duration`

You can change the formatting settings by passing options as the second argument to `duration`.

##### units

Array of possible units to use. Units are `y`, `mo`, `w`, `d`, `h`, `m`, `s`, and `ms`.

Units are skipped if their count is zero. For example, if you pass a duration of `1000` and units `["h", "m", "s"]`, the output will be "1 second".

Must be in descending order of unit size. For example, `["h", "m"]` is valid but `["m", "h"]` is not.

Default: `["y", "mo", "w", "d", "h", "m", "s"]`

```ts
duration(69000, { units: ["h", "m", "s", "ms"] });
// => "1 minute, 9 seconds"

duration(3600000, { units: ["h"] });
// => "1 hour"

duration(3600000, { units: ["m"] });
// => "60 minutes"

duration(3600000, { units: ["d", "h"] });
// => "1 hour"
```

##### largest

Integer representing the maximum number of units to use.

Default: `Infinity`

```ts
duration(1000000000000);
// => "31 years, 8 months, 1 week, 19 hours, 46 minutes, 40 seconds"

duration(1000000000000, { largest: 2 });
// => "31 years, 8 months"
```

##### round

A boolean that, if `true`, rounds the smallest unit.

Default: `false`

```ts
duration(1200);
// => "1.2 seconds"

duration(1200, { round: true });
// => "1 second"

duration(1600, { round: true });
// => "2 seconds"
```

##### delimiter

String to display between units.

Default: `", "` in most languages, `" ﻭ "` for Arabic

```ts
duration(22140000);
// => "6 hours, 9 minutes"

duration(22140000, { delimiter: " and " });
// => "6 hours and 9 minutes"
```

##### spacer

String to display between the count and the word.

Default: `" "`

```ts
duration(260040000);
// => "3 days, 14 minutes"

duration(260040000, { spacer: " whole " });
// => "3 whole days, 14 whole minutes"
```

##### decimal

String to display between the integer and decimal parts of a count, if relevant.

Default depends on the language.

```ts
duration(1200);
// => "1.2 seconds"

duration(1200, { decimal: " point " });
// => "1 point 2 seconds"
```

##### conjunction

String to include before the final unit.

You can also set `serialComma` to `false` to eliminate the final comma.

Default: `""`

```ts
duration(22140000, { conjunction: " and " });
// => "6 hours and 9 minutes"

duration(22141000, { conjunction: " and " });
// => "6 hours, 9 minutes, and 1 second"

duration(22140000, { conjunction: " and ", serialComma: false });
// => "6 hours and 9 minutes"

duration(22141000, { conjunction: " and ", serialComma: false });
// => "6 hours, 9 minutes and 1 second"
```

##### maxDecimalPoints

Integer that defines the maximum number of decimal points to show, if relevant. If `undefined`, the count will be converted to a string using [`Number.prototype.toString()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/toString).

This does not round any numbers. See [the `round` option](#round).

Default: `undefined`

```ts
duration(8123.456789);
// => "8.123456789 seconds"

duration(8123.456789, { maxDecimalPoints: 3 });
// => "8.123 seconds"

duration(8100, { maxDecimalPoints: 99 });
// => "8.1 seconds"

duration(8000, { maxDecimalPoints: 99 });
// => "8 seconds"

duration(7999, { maxDecimalPoints: 2 });
// => "7.99 seconds"
```

##### digitReplacements

Array of ten strings to which will replace the numerals 0-9. Useful if a language uses different numerals.

Default: `undefined` for most languages, `["۰", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"]` for Arabic

```ts
duration(1234);
// => "1.234 seconds"

duration(1234, {
    digitReplacements: ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"],
});
// => "One.TwoThreeFour seconds"
```

##### unitMeasures

_Use this option with care. It is an advanced feature._

Object used to customize the value used to calculate each unit of time. Most useful when you want to update the length of years or months, which have ambiguous lengths.

Default: `{ y: 31557600000, mo: 2629800000, w: 604800000, d: 86400000, h: 3600000, m: 60000, s: 1000, ms: 1 }`

```ts
duration(2629800000);
// => "1 month"

duration(2629800000, {
    unitMeasures: {
        y: 31557600000,
        mo: 30 * 86400000,
        w: 604800000,
        d: 86400000,
        h: 3600000,
        m: 60000,
        s: 1000,
        ms: 1,
    },
});
// => "1 month, 10 hours, 30 minutes"
```

##### language

Language for unit display. Accepts an [ISO 639-1 code](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes) from one of the [supported languages](#supported-languages), or a custom language object.

Default: `en` (English language object).

```ts
import { duration } from "@visulima/humanizer";
import { durationLanguage as es } from "@visulima/humanizer/language/es";
import { durationLanguage as ko } from "@visulima/humanizer/language/ko";

duration(3000, { language: es });
// => "3 segundos"

duration(5000, { language: ko });
// => "5 초"
```

#### Options for `parseDuration`

You can pass options as the second argument to `parseDuration`.

##### language

Language object containing the `unitMap` for parsing localized strings. See the `language` option for the `duration` function for details on how to import language objects.

If omitted or if the language object doesn't have a `unitMap`, parsing will only recognize standard English units (like "hour", "min", "d", "ms" etc.).

Default: English units.

```ts
import { parseDuration } from "@visulima/humanizer";
import { durationLanguage as de } from "@visulima/humanizer/language/de";
import { durationLanguage as ru } from "@visulima/humanizer/language/ru";

// Without language option (or if unitMap is missing)
parseDuration("3 Stunden"); // => undefined
parseDuration("5 часов"); // => undefined

// With language option containing a unitMap
parseDuration("3 Stunden", { language: de });
// => 10800000

parseDuration("5 часов, 10 минут", { language: ru });
// => 18600000
```

##### defaultUnit

Specifies the unit to assume if the input string is just a number (without any units).

Possible values: `y`, `mo`, `w`, `d`, `h`, `m`, `s`, `ms`.

Default: `"ms"`

```ts
parseDuration("1500");
// => 1500 (interpreted as 1500 ms)

parseDuration("1500", { defaultUnit: "s" });
// => 1500000 (interpreted as 1500 s)

parseDuration("-10", { defaultUnit: "d" });
// => -864000000 (interpreted as -10 days)
```

###### Supported languages

`duration` and `parseDuration` (when provided with a language object containing a `unitMap`) support the following languages:

| Language             | Code      |
| -------------------- | --------- |
| Afrikaans            | `af`      |
| Albanian             | `sq`      |
| Amharic              | `am`      |
| Arabic               | `ar`      |
| Basque               | `eu`      |
| Bengali              | `bn`      |
| Bulgarian            | `bg`      |
| Catalan              | `ca`      |
| Central Kurdish      | `ckb`     |
| Chinese, simplified  | `zh_CN`   |
| Chinese, traditional | `zh_TW`   |
| Croatian             | `hr`      |
| Czech                | `cs`      |
| Danish               | `da`      |
| Dutch                | `nl`      |
| English              | `en`      |
| Esperanto            | `eo`      |
| Estonian             | `et`      |
| Faroese              | `fo`      |
| Farsi/Persian        | `fa`      |
| Finnish              | `fi`      |
| French               | `fr`      |
| German               | `de`      |
| Greek                | `el`      |
| Hebrew               | `he`      |
| Hindi                | `hi`      |
| Hungarian            | `hu`      |
| Icelandic            | `is`      |
| Indonesian           | `id`      |
| Italian              | `it`      |
| Japanese             | `ja`      |
| Kannada              | `kn`      |
| Khmer                | `km`      |
| Korean               | `ko`      |
| Kurdish              | `ku`      |
| Lao                  | `lo`      |
| Latvian              | `lv`      |
| Lithuanian           | `lt`      |
| Macedonian           | `mk`      |
| Mongolian            | `mn`      |
| Malay                | `ms`      |
| Marathi              | `mr`      |
| Norwegian            | `no`      |
| Polish               | `pl`      |
| Portuguese           | `pt`      |
| Romanian             | `ro`      |
| Russian              | `ru`      |
| Serbian (Cyrillic)   | `sr`      |
| Serbian (Latin)      | `sr_Latn` |
| Slovak               | `sk`      |
| Slovenian            | `sl`      |
| Spanish              | `es`      |
| Swahili              | `sw`      |
| Swedish              | `sv`      |
| Tamil                | `ta`      |
| Telugu               | `te`      |
| Thai                 | `th`      |
| Turkish              | `tr`      |
| Ukrainian            | `uk`      |
| Urdu                 | `ur`      |
| Uzbek                | `uz`      |
| Uzbek (Cyrillic)     | `uz_CYR`  |
| Vietnamese           | `vi`      |
| Welsh                | `cy`      |

## Related

### Bytes

- [pretty-bytes](https://github.com/sindresorhus/pretty-bytes) - Convert bytes to a human readable string: `1337` → `1.34 kB`

### Duration

- [HumanizeDuration](https://github.com/EvanHahn/HumanizeDuration.js) - 361000 becomes "6 minutes, 1 second"
- [pretty-ms](https://github.com/sindresorhus/pretty-ms) - Convert milliseconds to a human readable string: `1337000000` → `15d 11h 23m 20s`

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js' release schedule](https://github.com/nodejs/release#release-schedule).
Here's [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guidelines.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## License

The visulima humanizer is open-sourced software licensed under the [MIT](LICENSE.md)


