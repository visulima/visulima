import { StatusCodes } from "http-status-codes";

export const extractStatusCode = (error: unknown, fallback: number = StatusCodes.INTERNAL_SERVER_ERROR): number => {
    if (!error) {
        return fallback;
    }

    const candidate = Number((error as { statusCode?: unknown }).statusCode ?? (error as { status?: unknown }).status);

    if (Number.isInteger(candidate) && candidate >= 400 && candidate <= 599) {
        return candidate;
    }

    return fallback;
};
