import type { DurationDigitReplacements, DurationOptions, DurationLanguage, DurationPiece, DurationUnitName } from "./types";
import { durationLanguage } from "./language/en";
import validateDurationLanguage from "./language/util/validate-duration-language";

const renderPiece = ({ unitName, unitCount }: DurationPiece, language: DurationLanguage, options: Required<DurationOptions>): string => {
    const { spacer, maxDecimalPoints } = options;

    let decimal: string = ".";

    if (options.decimal !== undefined) {
        decimal = options.decimal;
    } else if (language.decimal !== undefined) {
        decimal = language.decimal;
    }

    let digitReplacements: undefined | DurationDigitReplacements;

    if ("digitReplacements" in options) {
        digitReplacements = options.digitReplacements;
    } else if ("_digitReplacements" in language) {
        digitReplacements = language._digitReplacements;
    }

    let formattedCount: string;

    const normalizedUnitCount =
        maxDecimalPoints === void 0 ? unitCount : Math.floor(unitCount * Math.pow(10, maxDecimalPoints)) / Math.pow(10, maxDecimalPoints);
    const countStr = normalizedUnitCount.toString();

    if (digitReplacements) {
        formattedCount = "";

        for (var i = 0; i < countStr.length; i++) {
            const char = countStr[i];

            if (char === ".") {
                formattedCount += decimal;
            } else {
                // @ts-ignore because `char` should always be 0-9 at this point.
                formattedCount += digitReplacements[char];
            }
        }
    } else {
        formattedCount = countStr.replace(".", decimal);
    }

    const languageWord = language[unitName];
    let word = languageWord;

    if (typeof languageWord === "function") {
        word = languageWord(unitCount);
    }

    if (language._numberFirst) {
        return word + spacer + formattedCount;
    }

    return formattedCount + spacer + word;
};

const getPieces = (ms: number, options: Required<DurationOptions>): DurationPiece[] => {
    const { units } = options;

    if (!units.length) {
        return [];
    }

    const { unitMeasures } = options;
    var largest = options?.largest !== undefined ? options.largest : Infinity;

    // Get the counts for each unit. Doesn't round or truncate anything.
    // For example, might create an object like `{ y: 7, m: 6, w: 0, d: 5, h: 23.99 }`.
    var unitCounts: Partial<Record<DurationUnitName, number>> = {};

    let unitName: DurationUnitName;
    let i: number;
    let unitCount: number;
    let msRemaining: number = ms;

    for (i = 0; i < units.length; i++) {
        unitName = units[i] as DurationUnitName;

        const unitMs = unitMeasures[unitName];
        const isLast = i === units.length - 1;

        unitCount = isLast ? msRemaining / unitMs : Math.floor(msRemaining / unitMs);
        unitCounts[unitName] = unitCount;

        msRemaining -= unitCount * unitMs;
    }

    if (options.round) {
        // Update counts based on the `largest` option.
        // For example, if `largest === 2` and `unitCount` is `{ y: 7, m: 6, w: 0, d: 5, h: 23.99 }`,
        // updates to something like `{ y: 7, m: 6.2 }`.
        let unitsRemainingBeforeRound = largest;

        for (i = 0; i < units.length; i++) {
            unitName = units[i] as DurationUnitName;
            unitCount = unitCounts[unitName] as number;

            if (unitCount === 0) {
                continue;
            }

            unitsRemainingBeforeRound--;

            // "Take" the rest of the units into this one.
            if (unitsRemainingBeforeRound === 0) {
                for (let j = i + 1; j < units.length; j++) {
                    let smallerUnitName = units[j];
                    let smallerUnitCount = unitCounts[smallerUnitName];

                    unitCounts[unitName] += (smallerUnitCount * unitMeasures[smallerUnitName]) / unitMeasures[unitName];
                    unitCounts[smallerUnitName] = 0;
                }
                break;
            }
        }

        // Round the last piece (which should be the only non-integer).
        //
        // This can be a little tricky if the last piece "bubbles up" to a larger
        // unit. For example, "3 days, 23.99 hours" should be rounded to "4 days".
        // It can also require multiple passes. For example, "6 days, 23.99 hours"
        // should become "1 week".
        for (i = units.length - 1; i >= 0; i--) {
            unitName = units[i] as DurationUnitName;
            unitCount = unitCounts[unitName] as number;

            if (unitCount === 0) {
                continue;
            }

            var rounded = Math.round(unitCount);
            unitCounts[unitName] = rounded;

            if (i === 0) {
                break;
            }

            const previousUnitName: DurationUnitName = units[i - 1] as DurationUnitName;
            const previousUnitMs = unitMeasures[previousUnitName];
            const amountOfPreviousUnit = Math.floor((rounded * unitMeasures[unitName]) / previousUnitMs);

            if (amountOfPreviousUnit) {
                unitCounts[previousUnitName] += amountOfPreviousUnit;
                unitCounts[unitName] = 0;
            } else {
                break;
            }
        }
    }

    const result: DurationPiece[] = [];

    for (i = 0; i < units.length && result.length < largest; i++) {
        unitName = units[i] as DurationUnitName;
        unitCount = unitCounts[unitName] as number;

        if (unitCount) {
            result.push({ unitName: unitName, unitCount: unitCount });
        }
    }
    return result;
};

const formatPieces = (pieces: DurationPiece[], options: Required<DurationOptions>, ms: number): string => {
    const { language, units } = options;

    if (!pieces.length) {
        const smallestUnitName = units[units.length - 1] as DurationUnitName;

        return renderPiece({ unitName: smallestUnitName, unitCount: 0 }, language, options);
    }

    const { conjunction, serialComma } = options;

    let delimiter = ", ";

    if (options.delimiter !== undefined) {
        delimiter = options.delimiter;
    } else if (language.delimiter !== undefined) {
        delimiter = language.delimiter;
    }

    // timeAdverb part
    let adverb = "";

    if (options.timeAdverb && ms != 0) {
        adverb = language.future ?? "";

        if (ms < 0) {
            adverb = language.past ?? "";
        }
    }

    const renderedPieces: string[] = [];

    for (let i = 0; i < pieces.length; i++) {
        renderedPieces.push(renderPiece(pieces[i] as DurationPiece, language, options));
    }

    let result: string;

    if (!conjunction || pieces.length === 1) {
        result = renderedPieces.join(delimiter);
    } else if (pieces.length === 2) {
        result = renderedPieces.join(conjunction);
    } else {
        result = renderedPieces.slice(0, -1).join(delimiter) + (serialComma ? "," : "") + conjunction + renderedPieces.slice(-1);
    }

    if (adverb) {
        result = adverb.replace("%s", result);
    }

    return result;
};

const duration = (milliseconds: number | bigint, options?: DurationOptions) => {
    const isBigInt = typeof milliseconds === "bigint";

    if (!isBigInt && !Number.isFinite(milliseconds)) {
        throw new TypeError("Expected a finite number or bigint");
    }

    milliseconds = isBigInt ? Number(milliseconds) : milliseconds;

    const config = {
        language: durationLanguage,
        spacer: " ",
        conjunction: "",
        serialComma: true,
        units: ["y", "mo", "w", "d", "h", "m", "s"],
        round: false,
        unitMeasures: {
            y: 31557600000,
            mo: 2629800000,
            w: 604800000,
            d: 86400000,
            h: 3600000,
            m: 60000,
            s: 1000,
            ms: 1,
        },
        timeAdverb: false,
        ...options,
    } as Required<DurationOptions>;

    if (!config.language) {
        throw new Error("No language provided");
    }

    validateDurationLanguage(config.language);

    const absTime = Math.abs(milliseconds);

    const pieces = getPieces(absTime, config);

    return formatPieces(pieces, config, absTime);
};

export default duration;
