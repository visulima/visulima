/**
 * Validates an email address format according to basic RFC standards.
 * @param email The email address string to validate.
 * @returns True if the email address is valid, false otherwise.
 */
const validateEmail = (email: string): boolean => {
    // Basic validation first
    const basicRegex = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/;

    if (!basicRegex.test(email)) {
        return false;
    }

    const parts = email.split("@");

    if (parts.length !== 2) {
        return false;
    }

    const [localPart, domain] = parts;

    if (!localPart || !domain) {
        return false;
    }

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

export default validateEmail;
