import type { InspectType, Options } from "../types";
import truncate from "../utils/truncate";

const inspectDate: InspectType<Date> = (dateObject: Date, options: Options): string => {
    const stringRepresentation = dateObject.toJSON();

    if (stringRepresentation === null) {
        return "Invalid Date";
    }

    const split = stringRepresentation.split("T");
    const date = split[0];

    // If we need to - truncate the time portion, but never the date
    return options.stylize(`${date}T${truncate(split[1] as string, options.maxStringLength - (date as string).length - 1)}`, "date");
};

export default inspectDate;
