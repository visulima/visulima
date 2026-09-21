/** Reads Tailwind's theme tokens out of the live stylesheets. Moved unchanged. */
// ─── CSS variable scanner ─────────────────────────────────────────────────────

/**
 * Collect CSS custom properties from :root / html rules.
 * Recurses into \@layer, \@media, and \@supports blocks because Tailwind v4
 * wraps its theme tokens inside `\@layer theme { :root { ... } }`.
 */
export const isRootSelector = (selectorText: string): boolean =>
    selectorText.split(",").some((s) => {
        const t = s.trim();

        return t === ":root" || t === "html";
    });

const collectRootStyleVariables = (style: CSSStyleDeclaration, variables: Map<string, string>): void => {
    for (let i = 0; i < style.length; i += 1) {
        const prop = style[i] as string;

        if (prop.startsWith("--") && !prop.startsWith("--tw-") && !prop.startsWith("--brand-")) {
            const value = style.getPropertyValue(prop).trim();

            if (value) {
                variables.set(prop, value);
            }
        }
    }
};

export const collectVariablesFromRules = (rules: CSSRuleList, variables: Map<string, string>): void => {
    for (const rule of rules) {
        if (rule instanceof CSSStyleRule) {
            if (isRootSelector(rule.selectorText)) {
                collectRootStyleVariables(rule.style, variables);
            }
        } else if ("cssRules" in rule && rule.cssRules instanceof CSSRuleList) {
            // Recurse into \@layer, \@media, \@supports, and any other grouping rule
            collectVariablesFromRules(rule.cssRules, variables);
        }
    }
};

export const scanRootVariables = (): Map<string, string> => {
    const variables = new Map<string, string>();

    for (const sheet of document.styleSheets) {
        try {
            collectVariablesFromRules(sheet.cssRules, variables);
        } catch {
            // CORS — skip cross-origin stylesheets
        }
    }

    return variables;
};
