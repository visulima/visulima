import { CSI } from "./helpers";

const scroll = {
    down: (count = 1): string => `${CSI}T`.repeat(count),
    up: (count = 1): string => `${CSI}S`.repeat(count),
};

export default scroll;
