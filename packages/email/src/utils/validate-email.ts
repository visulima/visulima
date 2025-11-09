/**
 * Validate email address format
 */
export const validateEmail = (email: string): boolean => {
    // Basic validation first
    const basicRegex = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/;

    if (!basicRegex.test(email)) {
        return false;
    }

    const [localPart, domain] = email.split("@");

    // No consecutive dots anywhere
    if (email.includes("..")) {
        return false;
    }

    // Local part shouldn't start or end with dot
    if (localPart.startsWith(".") || localPart.endsWith(".")) {
        return false;
    }

    // Domain should have at least one dot and not start/end with hyphen
    if (!domain.includes(".") || domain.startsWith("-") || domain.endsWith("-")) {
        return false;
    }

    // Domain parts shouldn't start or end with hyphen
    const domainParts = domain.split(".");

    for (const part of domainParts) {
        if (part.startsWith("-") || part.endsWith("-") || part.length === 0) {
            return false;
        }
    }

    return true;
};
