import { distance } from "fastest-levenshtein";

export { closest, distance } from "fastest-levenshtein";

export const closestN = (string_: string, array: ReadonlyArray<string>, n: number): (string | undefined)[] => {
    const distances: number[] = Array.from({ length: n }, () => Infinity);
    const values: (string | undefined)[] = Array.from({ length: n }, () => undefined);

    for (const candidateValue of array) {
        let currentDistance = distance(string_, candidateValue);
        let currentValue: string = candidateValue;

        for (let index = 0; index < n; index += 1) {
            if (currentDistance < (distances[index] as number)) {
                const temporaryDistance = distances[index] as number;
                const temporaryValue = values[index];

                distances[index] = currentDistance;
                values[index] = currentValue;
                currentDistance = temporaryDistance;
                currentValue = temporaryValue ?? "";
            }
        }
    }

    return values;
};
