/**
 * Renders a minutes count as the largest whole-unit duration string
 * (`Nd`/`Nh`/`Nm`). Used for npm/`.npmrc` and yarn/`.yarnrc.yml`, whose
 * config values are time strings, not bare numbers.
 *
 * Note: the formatter is intentionally narrower than `parseDurationToMinutes`,
 * which also accepts `Nw`. We canonicalise on `d`/`h`/`m` because npm/yarn
 * round-trip a `1w` config to `7d` once vis rewrites it — there is no
 * ambiguity, only normalisation.
 */
const formatMinutesAsTimeString = (minutes: number): string => {
    if (!Number.isFinite(minutes) || minutes <= 0) {
        return "0m";
    }

    const whole = Math.max(1, Math.round(minutes));

    if (whole % (60 * 24) === 0) {
        return `${String(whole / (60 * 24))}d`;
    }

    if (whole % 60 === 0) {
        return `${String(whole / 60)}h`;
    }

    return `${String(whole)}m`;
};

/**
 * Parses a duration string (`2d`, `48h`, `15m`, bare number) into minutes.
 * Used by the drift checker for `.npmrc` / `.yarnrc.yml` reads.
 */
const parseDurationToMinutes = (input: string): number | undefined => {
    const trimmed = input.trim();

    if (trimmed === "") {
        return undefined;
    }

    const match = /^(\d+(?:\.\d+)?)\s*([mhdw]?)$/i.exec(trimmed);

    if (!match) {
        return undefined;
    }

    const value = Number.parseFloat(match[1]!);

    if (!Number.isFinite(value) || value < 0) {
        return undefined;
    }

    switch (match[2]?.toLowerCase()) {
        case "":
        case "m":
        case undefined: {
            return Math.round(value);
        }
        case "d": {
            return Math.round(value * 1440);
        }
        case "h": {
            return Math.round(value * 60);
        }
        case "w": {
            return Math.round(value * 10_080);
        }
        default: {
            return undefined;
        }
    }
};

const needsYamlQuote = (key: string): boolean => key.startsWith("@") || key.includes("/") || /[:#\s]/.test(key);
const renderYamlKey = (key: string): string => (needsYamlQuote(key) ? `'${key.replaceAll("'", "''")}'` : key);

export { formatMinutesAsTimeString, needsYamlQuote, parseDurationToMinutes, renderYamlKey };
