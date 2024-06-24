import { CSI } from "./constants";

export const scrollDown = (count = 1): string => `${CSI}T`.repeat(count);
export const scrollUp = (count = 1): string => `${CSI}S`.repeat(count);
