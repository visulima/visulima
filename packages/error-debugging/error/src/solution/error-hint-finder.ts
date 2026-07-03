import type { Solution, SolutionFinder } from "./types";

type HintError = Error & { hint: Solution | string[] | string | undefined };

const errorHintFinder: SolutionFinder = {
    handle: (error: HintError): Promise<Solution | undefined> => {
        if (error.hint === undefined) {
            return Promise.resolve(undefined);
        }

        if (typeof error.hint === "string" && error.hint !== "") {
            return Promise.resolve({ body: error.hint });
        }

        if (typeof error.hint === "object" && typeof (error.hint as Solution).body === "string") {
            return Promise.resolve(error.hint as Solution);
        }

        if (Array.isArray(error.hint)) {
            return Promise.resolve({ body: error.hint.join("\n") });
        }

        return Promise.resolve(undefined);
    },
    name: "errorHint",
    priority: 1,
};

export default errorHintFinder;
