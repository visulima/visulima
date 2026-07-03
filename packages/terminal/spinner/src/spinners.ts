// eslint-disable-next-line import/no-extraneous-dependencies
import cliSpinners from "cli-spinners";

import type { CustomSpinnerName, SpinnerFrame, SpinnerName } from "./types";

/**
 * Custom spinners from Rattles (https://github.com/vyfor/rattles)
 * and unicode-animations (https://github.com/gunnargray-dev/unicode-animations).
 */
const customSpinners: Record<CustomSpinnerName, SpinnerFrame> = {
    breathe: {
        frames: ["⠀", "⠂", "⠌", "⡑", "⢕", "⢝", "⣫", "⣟", "⣿", "⣟", "⣫", "⢝", "⢕", "⡑", "⠌", "⠂", "⠀"],
        interval: 100,
    },
    cascade: {
        frames: ["⠀⠀⠀⠀", "⠁⠀⠀⠀", "⠋⠀⠀⠀", "⠞⠁⠀⠀", "⡴⠋⠀⠀", "⣠⠞⠁⠀", "⢀⡴⠋⠀", "⠀⣠⠞⠁", "⠀⢀⡴⠋", "⠀⠀⣠⠞", "⠀⠀⢀⡴", "⠀⠀⠀⣠", "⠀⠀⠀⢀"],
        interval: 60,
    },
    checkerboard: {
        frames: ["⢕⢕⢕", "⡪⡪⡪", "⢊⠔⡡", "⡡⢊⠔"],
        interval: 250,
    },
    columns: {
        frames: [
            "⡀⠀⠀",
            "⡄⠀⠀",
            "⡆⠀⠀",
            "⡇⠀⠀",
            "⣇⠀⠀",
            "⣧⠀⠀",
            "⣷⠀⠀",
            "⣿⠀⠀",
            "⣿⡀⠀",
            "⣿⡄⠀",
            "⣿⡆⠀",
            "⣿⡇⠀",
            "⣿⣇⠀",
            "⣿⣧⠀",
            "⣿⣷⠀",
            "⣿⣿⠀",
            "⣿⣿⡀",
            "⣿⣿⡄",
            "⣿⣿⡆",
            "⣿⣿⡇",
            "⣿⣿⣇",
            "⣿⣿⣧",
            "⣿⣿⣷",
            "⣿⣿⣿",
            "⣿⣿⣿",
            "⠀⠀⠀",
        ],
        interval: 60,
    },
    diagSwipe: {
        frames: ["⠁⠀", "⠋⠀", "⠟⠁", "⡿⠋", "⣿⠟", "⣿⡿", "⣿⣿", "⣿⣿", "⣾⣿", "⣴⣿", "⣠⣾", "⢀⣴", "⠀⣠", "⠀⢀", "⠀⠀", "⠀⠀"],
        interval: 60,
    },
    dna: {
        frames: ["⠋⠉⠙⠚", "⠉⠙⠚⠒", "⠙⠚⠒⠂", "⠚⠒⠂⠂", "⠒⠂⠂⠒", "⠂⠂⠒⠲", "⠂⠒⠲⠴", "⠒⠲⠴⠤", "⠲⠴⠤⠄", "⠴⠤⠄⠋", "⠤⠄⠋⠉", "⠄⠋⠉⠙"],
        interval: 80,
    },
    doubleArrow: {
        frames: ["⇐", "⇖", "⇑", "⇗", "⇒", "⇘", "⇓", "⇙"],
        interval: 100,
    },
    fillSweep: {
        frames: ["⣀⣀", "⣤⣤", "⣶⣶", "⣿⣿", "⣿⣿", "⣿⣿", "⣶⣶", "⣤⣤", "⣀⣀", "⠀⠀", "⠀⠀"],
        interval: 100,
    },
    helix: {
        frames: ["⢌⣉⢎⣉", "⣉⡱⣉⡱", "⣉⢎⣉⢎", "⡱⣉⡱⣉", "⢎⣉⢎⣉", "⣉⡱⣉⡱", "⣉⢎⣉⢎", "⡱⣉⡱⣉", "⢎⣉⢎⣉", "⣉⡱⣉⡱", "⣉⢎⣉⢎", "⡱⣉⡱⣉", "⢎⣉⢎⣉", "⣉⡱⣉⡱", "⣉⢎⣉⢎", "⡱⣉⡱⣉"],
        interval: 80,
    },
    infinity: {
        frames: [
            "⢎⡱⣉⠆",
            "⢎⡱⣈⠆",
            "⢎⡱⣀⠆",
            "⢎⡱⣀⠄",
            "⢎⡱⣀ ",
            "⢎⡱⡀ ",
            "⢎⡱  ",
            "⢎⡱  ",
            "⢎⡡  ",
            "⢎⡠  ",
            "⢆⡠  ",
            "⢄⡠  ",
            "⢀⡠  ",
            " ⡠  ",
            " ⠠  ",
            " ⠰  ",
            " ⠐  ",
            " ⠐⠁ ",
            " ⠐⠉ ",
            " ⠐⠉⠂",
            " ⠐⠉⠆",
            " ⠐⢉⠆",
            " ⠐⣉⠆",
            " ⠰⣉⠆",
            " ⠰⣉⠆",
            " ⠱⣉⠆",
            "⠈⠱⣉⠆",
            "⠊⠱⣉⠆",
            "⠎⠱⣉⠆",
            "⢎⠱⣉⠆",
            "⢎⡱⣉⠆",
            "⢎⡱⣉⠆",
        ],
        interval: 60,
    },
    orbit: {
        frames: ["⠃", "⠉", "⠘", "⠰", "⢠", "⣀", "⡄", "⠆"],
        interval: 100,
    },
    pulse: {
        frames: ["⠀⠶⠀", "⠰⣿⠆", "⢾⣉⡷", "⣏⠀⣹", "⡁⠀⢈"],
        interval: 180,
    },
    rain: {
        frames: ["⢁⠂⠔⠈", "⠂⠌⡠⠐", "⠄⡐⢀⠡", "⡈⠠⠀⢂", "⠐⢀⠁⠄", "⠠⠁⠊⡀", "⢁⠂⠔⠈", "⠂⠌⡠⠐", "⠄⡐⢀⠡", "⡈⠠⠀⢂", "⠐⢀⠁⠄", "⠠⠁⠊⡀"],
        interval: 100,
    },
    scan: {
        frames: ["⠀⠀⠀⠀", "⡇⠀⠀⠀", "⣿⠀⠀⠀", "⢸⡇⠀⠀", "⠀⣿⠀⠀", "⠀⢸⡇⠀", "⠀⠀⣿⠀", "⠀⠀⢸⡇", "⠀⠀⠀⣿", "⠀⠀⠀⢸"],
        interval: 70,
    },
    scanline: {
        frames: ["⠉⠉⠉", "⠓⠓⠓", "⠦⠦⠦", "⣄⣄⣄", "⠦⠦⠦", "⠓⠓⠓"],
        interval: 120,
    },
    snake: {
        frames: ["⣁⡀", "⣉⠀", "⡉⠁", "⠉⠉", "⠈⠙", "⠀⠛", "⠐⠚", "⠒⠒", "⠖⠂", "⠶⠀", "⠦⠄", "⠤⠤", "⠠⢤", "⠀⣤", "⢀⣠", "⣀⣀"],
        interval: 80,
    },
    sparkle: {
        frames: ["⡡⠊⢔⠡", "⠊⡰⡡⡘", "⢔⢅⠈⢢", "⡁⢂⠆⡍", "⢔⠨⢑⢐", "⠨⡑⡠⠊"],
        interval: 150,
    },
    wave: {
        frames: ["⠁⠂⠄⡀", "⠂⠄⡀⢀", "⠄⡀⢀⠠", "⡀⢀⠠⠐", "⢀⠠⠐⠈", "⠠⠐⠈⠁", "⠐⠈⠁⠂", "⠈⠁⠂⠄"],
        interval: 100,
    },
    waveRows: {
        frames: ["⠖⠉⠉⠑", "⡠⠖⠉⠉", "⣠⡠⠖⠉", "⣄⣠⡠⠖", "⠢⣄⣠⡠", "⠙⠢⣄⣠", "⠉⠙⠢⣄", "⠊⠉⠙⠢", "⠜⠊⠉⠙", "⡤⠜⠊⠉", "⣀⡤⠜⠊", "⢤⣀⡤⠜", "⠣⢤⣀⡤", "⠑⠣⢤⣀", "⠉⠑⠣⢤", "⠋⠉⠑⠣"],
        interval: 90,
    },
};

/**
 * Registry of all available spinners.
 *
 * Includes spinners from:
 * - cli-spinners (https://github.com/sindresorhus/cli-spinners) — MIT
 * - Rattles (https://github.com/vyfor/rattles) — MIT
 * - unicode-animations (https://github.com/gunnargray-dev/unicode-animations) — MIT
 */
export const spinners: Record<SpinnerName, SpinnerFrame> = {
    ...cliSpinners,
    ...customSpinners,
};

/**
 * Retrieves a spinner from the registry by name.
 * @param name The name of the spinner to retrieve
 * @returns The spinner frame object, or `undefined` if the name is not in the registry
 */
export const getSpinner = (name: SpinnerName): SpinnerFrame | undefined => spinners[name];

/**
 * Retrieves a randomly selected spinner from the registry.
 * @returns A randomly selected spinner frame
 */
export const getRandomSpinner = (): SpinnerFrame => {
    const names = Object.keys(spinners) as SpinnerName[];
    // eslint-disable-next-line sonarjs/pseudo-random
    const randomIndex = Math.floor(Math.random() * names.length);
    const spinnerName = names[randomIndex] as SpinnerName;

    return spinners[spinnerName];
};

/**
 * Retrieves all available spinner names from the registry.
 * @returns Array of all spinner names
 */
export const getSpinnerNames = (): SpinnerName[] => Object.keys(spinners) as SpinnerName[];
