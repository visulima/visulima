import { BEL, OSC } from "./constants";

/**
 * Resets the progress bar to its default state (hidden).
 *
 * Sequence: `OSC 9 ; 4 ; 0 BEL`
 * @see {@link https://learn.microsoft.com/en-us/windows/terminal/tutorials/progress-bar-sequences}
 */
export const resetProgressBar: string = `${OSC}9;4;0${BEL}`;

/**
 * Returns a sequence for setting the progress bar to a specific percentage (0-100) in the "default" state.
 *
 * Sequence: `OSC 9 ; 4 ; 1 ; Percentage BEL`
 * @param percentage The progress percentage (0-100, clamped automatically)
 * @returns The progress bar sequence
 * @see {@link https://learn.microsoft.com/en-us/windows/terminal/tutorials/progress-bar-sequences}
 */
export const setProgressBar = (percentage: number): string => {
    const clamped = Math.min(Math.max(0, percentage), 100);

    return `${OSC}9;4;1;${clamped}${BEL}`;
};

/**
 * Returns a sequence for setting the progress bar to a specific percentage (0-100) in the "Error" state.
 *
 * Sequence: `OSC 9 ; 4 ; 2 ; Percentage BEL`
 * @param percentage The progress percentage (0-100, clamped automatically)
 * @returns The error progress bar sequence
 * @see {@link https://learn.microsoft.com/en-us/windows/terminal/tutorials/progress-bar-sequences}
 */
export const setErrorProgressBar = (percentage: number): string => {
    const clamped = Math.min(Math.max(0, percentage), 100);

    return `${OSC}9;4;2;${clamped}${BEL}`;
};

/**
 * Sets the progress bar to the indeterminate state.
 *
 * Sequence: `OSC 9 ; 4 ; 3 BEL`
 * @see {@link https://learn.microsoft.com/en-us/windows/terminal/tutorials/progress-bar-sequences}
 */
export const setIndeterminateProgressBar: string = `${OSC}9;4;3${BEL}`;

/**
 * Returns a sequence for setting the progress bar to a specific percentage (0-100) in the "Warning" state.
 *
 * Sequence: `OSC 9 ; 4 ; 4 ; Percentage BEL`
 * @param percentage The progress percentage (0-100, clamped automatically)
 * @returns The warning progress bar sequence
 * @see {@link https://learn.microsoft.com/en-us/windows/terminal/tutorials/progress-bar-sequences}
 */
export const setWarningProgressBar = (percentage: number): string => {
    const clamped = Math.min(Math.max(0, percentage), 100);

    return `${OSC}9;4;4;${clamped}${BEL}`;
};
