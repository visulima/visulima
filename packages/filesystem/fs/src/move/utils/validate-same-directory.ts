import { dirname } from "@visulima/path";

class SameDirectoryError extends Error {
    public constructor(source: string, destination: string) {
        super(`Source directory "${dirname(source)}" does not match destination directory "${dirname(destination)}"`);
        this.name = "SameDirectoryError";
    }
}

const validateSameDirectory = (source: string, destination: string): void => {
    if (!source || !destination) {
        throw new Error("Source and destination paths must not be empty");
    }

    if (dirname(source) !== dirname(destination)) {
        throw new SameDirectoryError(source, destination);
    }
};

export default validateSameDirectory;
