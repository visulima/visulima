const parse = (version: string): { nums: number[]; pre: string | undefined } => {
    const [core, pre] = version.split("-");
    const nums = (core as string).split(".").map((segment) => Number.parseInt(segment, 10) || 0);

    return { nums, pre };
};

const semverGt = (version1: string, version2: string): boolean => {
    const v1 = parse(version1);
    const v2 = parse(version2);

    const length = Math.max(v1.nums.length, v2.nums.length);

    for (let index = 0; index < length; index++) {
        const a = v1.nums[index] ?? 0;
        const b = v2.nums[index] ?? 0;

        if (a > b) {
            return true;
        }

        if (a < b) {
            return false;
        }
    }

    // Cores are equal — apply prerelease ordering.
    // A version without a prerelease is greater than the same core with one.
    if (v1.pre === undefined && v2.pre !== undefined) {
        return true;
    }

    if (v1.pre !== undefined && v2.pre === undefined) {
        return false;
    }

    if (v1.pre === undefined && v2.pre === undefined) {
        return false;
    }

    const preA = (v1.pre as string).split(".");
    const preB = (v2.pre as string).split(".");
    const preLength = Math.max(preA.length, preB.length);

    for (let index = 0; index < preLength; index++) {
        const identifierA = preA[index];
        const identifierB = preB[index];

        // A larger set of prerelease fields, when all preceding identifiers are equal, has higher precedence.
        if (identifierA === undefined) {
            return false;
        }

        if (identifierB === undefined) {
            return true;
        }

        if (identifierA === identifierB) {
            continue;
        }

        const numberA = Number.parseInt(identifierA, 10);
        const numberB = Number.parseInt(identifierB, 10);
        const isNumericA = !Number.isNaN(numberA) && String(numberA) === identifierA;
        const isNumericB = !Number.isNaN(numberB) && String(numberB) === identifierB;

        if (isNumericA && isNumericB) {
            return numberA > numberB;
        }

        // Numeric identifiers always have lower precedence than non-numeric identifiers.
        if (isNumericA) {
            return false;
        }

        if (isNumericB) {
            return true;
        }

        return identifierA > identifierB;
    }

    return false;
};

export default semverGt;
