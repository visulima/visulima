import type { StopOutput } from "../../types";

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

    // eslint-disable-next-line no-loops/no-loops
    for (let index = 1; index < l; index++) {
        const step = (steps - 1) * (stops[index].position! - stops[index - 1].position!);

        substeps.push(Math.max(1, Math.round(step)));
    }

    let totalSubsteps = 1;

    // eslint-disable-next-line no-loops/no-loops,no-plusplus
    for (let n = l - 1; n--; ) {
        totalSubsteps += substeps[n];
    }

    // eslint-disable-next-line no-loops/no-loops
    while (totalSubsteps !== steps) {
        if (totalSubsteps < steps) {
            const min = Math.min(...substeps);

            substeps[substeps.indexOf(min)]++;
            totalSubsteps++;
        } else {
            const max = Math.max(...substeps);

            substeps[substeps.indexOf(max)]--;
            totalSubsteps--;
        }
    }

    return substeps;
};
