import type { StopOutput } from "../../types";

// eslint-disable-next-line import/prefer-default-export -- public API uses named export
export const computeSubSteps = (stops: StopOutput[], steps: number): number[] => {
    const l = stops.length;

    // eslint-disable-next-line no-param-reassign
    steps = Number.parseInt(steps.toString(), 10);

    if (Number.isNaN(steps) || steps < 2) {
        throw new Error("Invalid number of steps (< 2)");
    }

    if (steps < l) {
        throw new Error("Number of steps cannot be inferior to number of stops");
    }

    const substeps: number[] = [];

    for (let index = 1; index < l; index += 1) {
        const step = (steps - 1) * ((stops[index] as StopOutput).position - (stops[index - 1] as StopOutput).position);

        substeps.push(Math.max(1, Math.round(step)));
    }

    let totalSubsteps = 1;

    for (let n = l - 2; n >= 0; n -= 1) {
        totalSubsteps += substeps[n] as number;
    }

    while (totalSubsteps !== steps) {
        if (totalSubsteps < steps) {
            const min = Math.min(...substeps);
            const minIndex = substeps.indexOf(min);

            substeps[minIndex] = (substeps[minIndex] as number) + 1;
            totalSubsteps += 1;
        } else {
            const max = Math.max(...substeps);
            const maxIndex = substeps.indexOf(max);

            substeps[maxIndex] = (substeps[maxIndex] as number) - 1;
            totalSubsteps -= 1;
        }
    }

    return substeps;
};
