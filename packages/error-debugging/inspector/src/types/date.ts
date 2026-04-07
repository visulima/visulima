import type { InspectType, Options } from "../types";
import truncate from "../utils/truncate";

const inspectDate: InspectType<Date> = (dateObject: Date, options: Options): string => {
    // toJSON() can return null for invalid dates at runtime, even though TS types say string
    const stringRepresentation = dateObject.toJSON() as string | null;

    if (stringRepresentation === null) {
        return "Invalid Date";
    }

    const split = stringRepresentation.split("T");
    const date = split[0] as string;

    // If we need to - truncate the time portion, but never the date
    return options.stylize(`${date}T${truncate(split[1] as string, options.truncate - date.length - 1)}`, "date");
};

export default inspectDate;
