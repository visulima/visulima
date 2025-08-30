import type { Solution, SolutionFinder } from "../types";

type HintError = Error & { hint: Solution | string[] | string | undefined };

const errorHintFinder: SolutionFinder = {
    handle: async (error: HintError): Promise<Solution | undefined> => {
        if (error.hint === undefined) {
            return undefined;
        }

        if (typeof error.hint === "string") {
            return { body: error.hint };
        }

        if (typeof error.hint === "object" && typeof (error.hint as Solution).body === "string") {
            return error.hint as Solution;
        }

        if (Array.isArray(error.hint)) {
            return { body: (error.hint as string[]).join("\n") };
        }

        return undefined;
    },
    name: "errorHint",
    priority: 1,
};

export default errorHintFinder;
