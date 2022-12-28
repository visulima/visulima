import type { FilePart } from "./types";

const hasContent = (part: Partial<FilePart>): part is FilePart => typeof part.start === "number" && part.start >= 0 && !!part.body;

export default hasContent;
