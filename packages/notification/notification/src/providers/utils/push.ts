import NotificationError from "../../errors/notification-error";

/**
 * Checks a push time-to-live (seconds) is a non-negative integer.
 * @param provider The provider id used as the error component.
 * @param ttl The time-to-live to check; `undefined` means "not set" and passes.
 * @returns A {@link NotificationError} when `ttl` is invalid, otherwise `undefined`.
 */
const validatePushTtl = (provider: string, ttl: number | undefined): NotificationError | undefined => {
    if (ttl === undefined || (Number.isInteger(ttl) && ttl >= 0)) {
        return undefined;
    }

    return new NotificationError(provider, `Invalid ttl: expected a non-negative integer number of seconds, got ${String(ttl)}`);
};

export default validatePushTtl;
