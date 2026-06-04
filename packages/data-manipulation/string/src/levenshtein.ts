/* eslint-disable import/no-extraneous-dependencies */
import { distance } from "fastest-levenshtein";

export const closestN = (string_: string, array: ReadonlyArray<string>, n: number): (string | undefined)[] => {
    const distances = Array.from({ length: n }).fill(Infinity) as number[];
    const values = Array.from({ length: n }).fill(undefined) as (string | undefined)[];

    for (const element of array) {
        const candidateValue = element;
        let currentDistance = distance(string_, candidateValue);
        let currentValue: string | undefined = candidateValue;

        for (let index = 0; index < n; index += 1) {
            if (currentDistance < (distances[index] as number)) {
                const temporaryDistance = distances[index] as number;
                const temporaryValue = values[index];

                distances[index] = currentDistance;
                values[index] = currentValue;
                currentDistance = temporaryDistance;
                currentValue = temporaryValue;
            }
        }
    }

    return values;
};

export { closest, distance } from "fastest-levenshtein";
