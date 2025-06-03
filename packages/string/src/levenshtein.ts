// eslint-disable-next-line import/no-extraneous-dependencies
import { distance } from "fastest-levenshtein";

export { closest, distance } from "fastest-levenshtein";

export const closestN = (string_: string, array: ReadonlyArray<string>, n: number): (string | null)[] => {
    const distances = new Array(n).fill(Infinity);
    const values = new Array(n).fill(null);

    for (let value of array) {
        let distribution = distance(string_, value);

        for (let index = 0; index < n; index++) {
            if (distribution < distances[index]) {
                [distribution, distances[index]] = [distances[index], distribution];
                [value, values[index]] = [values[index], value];
            }
        }
    }

    return values;
};
