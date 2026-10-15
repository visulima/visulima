import { getZone } from "../../src/zone";

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

/**
 * Roughly when a zone's offset changes between two instants, found by scanning at a fixed step. Reads the zone's
 * raw offsets, so it does not depend on the remembered ones the engine uses.
 */
const clockChangesBetween = (zoneName: string, from: number, to: number, step: number): number[] => {
    const zone = getZone(zoneName);
    const found: number[] = [];
    let previous = zone.rawOffset(from);

    for (let instant = from; instant < to; instant += step) {
        const offset = zone.rawOffset(instant);

        if (offset !== previous) {
            found.push(instant);
            previous = offset;
        }
    }

    return found;
};

export { clockChangesBetween, DAY, HOUR, MINUTE };
