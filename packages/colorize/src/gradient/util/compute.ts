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

    // eslint-disable-next-line no-loops/no-loops,no-plusplus
    for (let index = 1; index < l; index++) {
        // eslint-disable-next-line security/detect-object-injection
        const step = (steps - 1) * ((stops[index] as StopOutput).position - (stops[index - 1] as StopOutput).position);

        substeps.push(Math.max(1, Math.round(step)));
    }

    let totalSubsteps = 1;

    // eslint-disable-next-line no-loops/no-loops,no-plusplus
    for (let n = l - 1; n--; ) {
        // eslint-disable-next-line security/detect-object-injection
        totalSubsteps += substeps[n] as number;
    }

    // eslint-disable-next-line no-loops/no-loops
    while (totalSubsteps !== steps) {
        if (totalSubsteps < steps) {
            const min = Math.min(...substeps);

            // eslint-disable-next-line no-plusplus
            (substeps[substeps.indexOf(min)] as number)++;
            // eslint-disable-next-line no-plusplus
            totalSubsteps++;
        } else {
            const max = Math.max(...substeps);

            // eslint-disable-next-line no-plusplus
            (substeps[substeps.indexOf(max)] as number)--;
            // eslint-disable-next-line no-plusplus
            totalSubsteps--;
        }
    }

    return substeps;
};
