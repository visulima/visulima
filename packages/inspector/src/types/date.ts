import type { Options } from "../types";
import truncate from "../utils/truncate";

const inspectDate = (dateObject: Date, options: Options): string => {
    const stringRepresentation = dateObject.toJSON();

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (stringRepresentation === null) {
        return "Invalid Date";
    }

    const split = stringRepresentation.split("T");
    const date = split[0];

    // If we need to - truncate the time portion, but never the date
    return options.stylize(`${date}T${truncate(split[1] as string, options.truncate - (date as string).length - 1)}`, "date");
};

export default inspectDate;
