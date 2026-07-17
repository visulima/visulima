/**
 * Public input-classification surface (`@visulima/tui/input`).
 *
 * Predicates for deciding whether a keypress should be treated as text the
 * user meant to type. Text-entry components share these so that "is this
 * insertable?" stays one answer across the library rather than a per-component
 * guess.
 */
export { isControlCharacter, isInsertableInput } from "../input-utils";
