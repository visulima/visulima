import type { FilePart } from "./types";

/**
 * Type guard to check if a partial file part has valid content.
 * Validates that the part has a valid start position and body stream.
 * @param part Partial file part to check
 * @returns True if the part has valid content (start >= 0 and body exists)
 */
const hasContent = (part: Partial<FilePart>): part is FilePart => typeof part.start === "number" && part.start >= 0 && !!part.body;

export default hasContent;
