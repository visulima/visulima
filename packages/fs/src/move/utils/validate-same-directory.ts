import { dirname } from "@visulima/path";

const validateSameDirectory = (source: string, destination: string) => {
    if (dirname(source) !== dirname(destination)) {
        throw new Error("`source` and `destination` must be in the same directory");
    }
};

export default validateSameDirectory;
