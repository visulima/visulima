import { durationLanguage } from "./language/en";
import validateDurationLanguage from "./language/util/validate-duration-language";
import type { DurationDigitReplacements, DurationLanguage, DurationOptions, DurationPiece, DurationUnitMeasures, DurationUnitName } from "./types";

interface InternalOptions {
    conjunction: string;
    decimal?: string;
    delimiter?: string;
    digitReplacements?: DurationDigitReplacements;
    fallbacks?: string[];
    language: DurationLanguage;
    largest?: number;
    maxDecimalPoints?: number;
    round: boolean;
    serialComma: boolean;
    spacer: string;
    timeAdverb: boolean;
    unitMeasures: DurationUnitMeasures;
    units: DurationUnitName[];
}

const toFixed = (number_: number, fixed: number): number => {
    // eslint-disable-next-line no-param-reassign
    fixed = fixed || -1;

    // eslint-disable-next-line @rushstack/security/no-unsafe-regexp,security/detect-non-literal-regexp
    const matches = new RegExp(`^-?\\d+(?:.\\d{0,${String(fixed)}})?`).exec(number_.toString());

    if (matches === null) {
        return number_; // can be undefined when num is Number.POSITIVE_INFINITY
    }

    return Number.parseFloat(matches[0]);
};

// eslint-disable-next-line sonarjs/cognitive-complexity
const renderPiece = ({ unitCount, unitName }: DurationPiece, language: DurationLanguage, options: InternalOptions): string => {
    let { spacer } = options;
    const { maxDecimalPoints } = options;

    let decimal = ".";

    if (options.decimal !== undefined) {
        decimal = options.decimal;
    } else if (language.decimal !== undefined) {
        decimal = language.decimal;
    }

    let digitReplacements: DurationDigitReplacements | undefined;

    if ("digitReplacements" in options) {
        digitReplacements = options.digitReplacements;
    } else if ("_digitReplacements" in language) {
        // eslint-disable-next-line no-underscore-dangle
        digitReplacements = language._digitReplacements;
    }

    let formattedCount: string;

    let normalizedUnitCount = unitCount;

    if (maxDecimalPoints !== undefined) {
        // normalizedUnitCount = Math.floor(unitCount * 10 ** maxDecimalPoints) / 10 ** maxDecimalPoints;
        normalizedUnitCount = toFixed(unitCount, maxDecimalPoints);
    }

    const countString = normalizedUnitCount.toString();

    // eslint-disable-next-line no-underscore-dangle
    if (!language._hideCountIf2 || unitCount !== 2) {
        if (digitReplacements) {
            formattedCount = "";

            // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
            for (const char of countString) {
                // `char` should always be 0-9 at this point.
                // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                formattedCount += char === "." ? decimal : digitReplacements[char as keyof typeof digitReplacements];
            }
        } else {
            formattedCount = countString.replace(".", decimal);
        }
    } else {
        formattedCount = "";
    }

    // eslint-disable-next-line security/detect-object-injection
    const languageWord = language[unitName];
    let word = languageWord as string;

    if (typeof languageWord === "function") {
        word = languageWord(unitCount) as string;
    }

    // Never add a spacer if the count is hidden
    // eslint-disable-next-line no-underscore-dangle
    if (language._hideCountIf2 && unitCount === 2) {
        spacer = "";
    }

    // eslint-disable-next-line no-underscore-dangle
    if (language._numberFirst) {
        return (word as string) + spacer + formattedCount;
    }

    return formattedCount + spacer + (word as string);
};

// eslint-disable-next-line sonarjs/cognitive-complexity
const getPieces = (ms: number, options: InternalOptions): DurationPiece[] => {
    const { units } = options;

    if (units.length === 0) {
        return [];
    }

    const { unitMeasures } = options;
    const largest = options.largest ?? Number.POSITIVE_INFINITY;

    // Get the counts for each unit. Doesn't round or truncate anything.
    // For example, might create an object like `{ y: 7, m: 6, w: 0, d: 5, h: 23.99 }`.
    const unitCounts: Partial<Record<DurationUnitName, number>> = {};

    let unitName: DurationUnitName;
    let index: number;
    let unitCount: number;
    let msRemaining: number = ms;

    // eslint-disable-next-line no-loops/no-loops,no-plusplus
    for (index = 0; index < units.length; index++) {
        // eslint-disable-next-line security/detect-object-injection
        unitName = units[index] as DurationUnitName;

        // eslint-disable-next-line security/detect-object-injection
        const unitMs = unitMeasures[unitName];
        const isLast = index === units.length - 1;

        unitCount = isLast ? msRemaining / unitMs : Math.floor(msRemaining / unitMs);
        // eslint-disable-next-line security/detect-object-injection
        unitCounts[unitName] = unitCount;

        msRemaining -= unitCount * unitMs;
    }

    if (options.round) {
        // Update counts based on the `largest` option.
        // For example, if `largest === 2` and `unitCount` is `{ y: 7, m: 6, w: 0, d: 5, h: 23.99 }`,
        // updates to something like `{ y: 7, m: 6.2 }`.
        let unitsRemainingBeforeRound = largest;

        // eslint-disable-next-line no-plusplus,no-loops/no-loops
        for (index = 0; index < units.length; index++) {
            // eslint-disable-next-line security/detect-object-injection
            unitName = units[index] as DurationUnitName;
            // eslint-disable-next-line security/detect-object-injection
            unitCount = unitCounts[unitName] as number;

            if (unitCount === 0) {
                // eslint-disable-next-line no-continue
                continue;
            }

            // eslint-disable-next-line no-plusplus
            unitsRemainingBeforeRound--;

            // "Take" the rest of the units into this one.
            if (unitsRemainingBeforeRound === 0) {
                // eslint-disable-next-line @typescript-eslint/naming-convention,no-loops/no-loops,no-underscore-dangle,no-plusplus
                for (let index_ = index + 1; index_ < units.length; index_++) {
                    // eslint-disable-next-line no-underscore-dangle,security/detect-object-injection
                    const smallerUnitName = units[index_] as DurationUnitName;
                    // eslint-disable-next-line security/detect-object-injection
                    const smallerUnitCount = unitCounts[smallerUnitName] as number;

                    // @ts-expect-error unitCounts[unitName] is defined
                    // eslint-disable-next-line security/detect-object-injection,@typescript-eslint/restrict-plus-operands
                    unitCounts[unitName] += (smallerUnitCount * unitMeasures[smallerUnitName]) / unitMeasures[unitName];
                    // eslint-disable-next-line security/detect-object-injection
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
        // eslint-disable-next-line no-plusplus,no-loops/no-loops
        for (index = units.length - 1; index >= 0; index--) {
            // eslint-disable-next-line security/detect-object-injection
            unitName = units[index] as DurationUnitName;
            // eslint-disable-next-line security/detect-object-injection
            unitCount = unitCounts[unitName] as number;

            if (unitCount === 0) {
                // eslint-disable-next-line no-continue
                continue;
            }

            const rounded = Math.round(unitCount);

            // eslint-disable-next-line security/detect-object-injection
            unitCounts[unitName] = rounded;

            if (index === 0) {
                break;
            }

            const previousUnitName: DurationUnitName = units[index - 1] as DurationUnitName;
            // eslint-disable-next-line security/detect-object-injection
            const previousUnitMs = unitMeasures[previousUnitName];
            // eslint-disable-next-line security/detect-object-injection
            const amountOfPreviousUnit = Math.floor((rounded * unitMeasures[unitName]) / previousUnitMs);

            if (amountOfPreviousUnit) {
                // @ts-expect-error unitCounts[previousUnitName] is defined
                // eslint-disable-next-line security/detect-object-injection,@typescript-eslint/restrict-plus-operands
                unitCounts[previousUnitName] += amountOfPreviousUnit;
                // eslint-disable-next-line security/detect-object-injection
                unitCounts[unitName] = 0;
            } else {
                break;
            }
        }
    }

    const result: DurationPiece[] = [];

    // eslint-disable-next-line no-plusplus,no-loops/no-loops
    for (index = 0; index < units.length && result.length < largest; index++) {
        // eslint-disable-next-line security/detect-object-injection
        unitName = units[index] as DurationUnitName;
        // eslint-disable-next-line security/detect-object-injection
        unitCount = unitCounts[unitName] as number;

        // If the result is not rounded, and `largest` option has been set, aggregate the rest and apply the
        // `maxDecimalPoints` to truncate the decimals
        if (unitCount && !options.round && result.length === largest - 1) {
            // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
            let index_;
            let remainder = 0;

            // eslint-disable-next-line no-loops/no-loops,no-plusplus
            for (index_ = index + 1, units.length; index_ < units.length; index_++) {
                // eslint-disable-next-line no-underscore-dangle,security/detect-object-injection
                const remainderUnitName = units[index_] as DurationUnitName;

                // eslint-disable-next-line security/detect-object-injection
                remainder += (unitCounts[remainderUnitName] as number) * (options.unitMeasures[remainderUnitName] / options.unitMeasures[unitName]);
            }

            unitCount += remainder;

            if (options.maxDecimalPoints !== undefined) {
                unitCount = toFixed(unitCount, options.maxDecimalPoints);
            }
        }

        if (unitCount) {
            result.push({ unitCount, unitName });
        }
    }

    return result;
};

// eslint-disable-next-line sonarjs/cognitive-complexity
const formatPieces = (pieces: DurationPiece[], options: InternalOptions, ms: number): string => {
    const { language, units } = options;

    if (pieces.length === 0) {
        const smallestUnitName = units.at(-1) as DurationUnitName;

        return renderPiece({ unitCount: 0, unitName: smallestUnitName }, language, options);
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

    if (options.timeAdverb && ms !== 0) {
        adverb = language.future ?? "";

        if (ms < 0) {
            adverb = language.past ?? "";
        }
    }

    const renderedPieces: string[] = [];

    // eslint-disable-next-line no-loops/no-loops,@typescript-eslint/naming-convention,no-restricted-syntax,no-underscore-dangle
    for (const piece_ of pieces) {
        const piece = piece_ as DurationPiece;

        renderedPieces.push(renderPiece(piece, language, options));
    }

    let result: string;

    if (!conjunction || pieces.length === 1) {
        result = renderedPieces.join(delimiter);
    } else if (pieces.length === 2) {
        result = renderedPieces.join(conjunction);
    } else {
        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
        result = renderedPieces.slice(0, -1).join(delimiter) + (serialComma ? "," : "") + conjunction + renderedPieces.at(-1);
    }

    if (adverb) {
        result = adverb.replace("%s", result);
    }

    return result;
};

const duration = (milliseconds: number, options?: DurationOptions): string => {
    if (Number.isNaN(milliseconds)) {
        throw new TypeError("Expected a valid number");
    }

    if (typeof milliseconds !== "number") {
        throw new TypeError("Expected a number for milliseconds input");
    }

    const config = {
        conjunction: "",
        language: durationLanguage,
        round: false,
        serialComma: true,
        spacer: " ",
        timeAdverb: false,
        unitMeasures: {
            d: 86_400_000,
            h: 3_600_000,
            m: 60_000,
            mo: 2_629_746_000, // 365.2425 / 12 = 30.436875 days
            ms: 1,
            s: 1000,
            w: 604_800_000,
            y: 31_556_952_000, // 365 + 1/4 - 1/100 + 1/400 (actual leap day rules) = 365.2425 days
        },
        units: ["w", "d", "h", "m", "s"],
        ...options,
    } as InternalOptions;

    validateDurationLanguage(config.language);

    // Has the nice side effect of converting things to numbers. For example,
    // converts `"123"` and `Number(123)` to `123`.
    const absTime = Math.abs(milliseconds as number);

    const pieces = getPieces(absTime, config);

    return formatPieces(pieces, config, milliseconds as number);
};

export default duration;
