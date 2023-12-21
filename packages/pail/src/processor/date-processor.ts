import type { Meta, Processor } from "../types";

const dateProcessor: Processor = <L>(meta: Meta<L>): Meta<L> => {
    if (typeof meta.date === "object") {
        meta.date = (meta.date as Date).toISOString();
    }

    return meta;
};

export default dateProcessor;
