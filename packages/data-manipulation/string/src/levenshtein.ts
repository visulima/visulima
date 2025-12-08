import { distance } from "fastest-levenshtein";

export { closest, distance } from "fastest-levenshtein";

export const closestN = (string_: string, array: ReadonlyArray<string>, n: number): (string | undefined)[] => {
    const distances = Array.from({ length: n }, () => Infinity);
    const values = Array.from({ length: n }, () => undefined as string | undefined);

    for (const candidateValue of array) {
        let currentDistance = distance(string_, candidateValue);
        let currentValue = candidateValue;

        for (let index = 0; index < n; index += 1) {
            if (currentDistance < distances[index]) {
                const temporaryDistance = distances[index];
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
