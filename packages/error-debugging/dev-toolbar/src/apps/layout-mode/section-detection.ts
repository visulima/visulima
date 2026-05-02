import { cleanCssClasses, generateSelector as inspectorGenerateSelector, getNearbyText } from "../inspector/element-utils";
import { getElementLabel } from "../inspector/element-utils";

import type { DetectedSection } from "./types";

const SECTION_TAGS = new Set(["nav", "header", "main", "section", "article", "footer", "aside"]);

const SECTION_ROLES: Record<string, string> = {
    banner: "Header",
    complementary: "Sidebar",
    contentinfo: "Footer",
    main: "Main Content",
    navigation: "Navigation",
    region: "Section",
};

const TAG_LABELS: Record<string, string> = {
    article: "Article",
    aside: "Sidebar",
    footer: "Footer",
    header: "Header",
    main: "Main Content",
    nav: "Navigation",
    section: "Section",
};

const SKIP_TAGS = new Set(["script", "style", "noscript", "link", "meta"]);
const MIN_SECTION_HEIGHT = 40;

const isEffectivelyFixed = (element_: HTMLElement): boolean => {
    let current: HTMLElement | null = element_;

    while (current && current !== document.body && current !== document.documentElement) {
        const { position } = window.getComputedStyle(current);

        if (position === "fixed" || position === "sticky") {
            return true;
        }

        current = current.parentElement;
    }

    return false;
};

/**
 * Generate a stable selector for re-finding a section element after re-renders.
 * Prefers unique semantic tags (e.g. the only `<nav>`) before delegating to
 * the inspector's general-purpose selector generator.
 */
export const generateSelector = (element_: HTMLElement): string => {
    const tag = element_.tagName.toLowerCase();

    if (["footer", "header", "main", "nav"].includes(tag) && document.querySelectorAll(tag).length === 1) {
        return tag;
    }

    return inspectorGenerateSelector(element_);
};

/**
 * Determine a human-readable label for a detected section.
 */
export const labelSection = (element_: HTMLElement): string => {
    const tag = element_.tagName.toLowerCase();
    const ariaLabel = element_.getAttribute("aria-label");

    if (ariaLabel) {
        return ariaLabel;
    }

    const role = element_.getAttribute("role");

    if (role && SECTION_ROLES[role]) {
        return SECTION_ROLES[role];
    }

    if (TAG_LABELS[tag]) {
        return TAG_LABELS[tag];
    }

    const heading = element_.querySelector("h1, h2, h3, h4, h5, h6");

    if (heading) {
        const text = heading.textContent?.trim();

        if (text && text.length <= 50) {
            return text;
        }

        if (text) {
            return `${text.slice(0, 47)}...`;
        }
    }

    const name = getElementLabel(element_);

    return name.charAt(0).toUpperCase() + name.slice(1);
};

const getCleanClassName = (element_: HTMLElement): string | null => {
    if (element_.classList.length === 0) {
        return null;
    }

    const cleaned = cleanCssClasses(element_.classList).split(/\s+/).filter((c) => c.length > 2 && !/^[a-z]{1,2}$/.test(c));

    return cleaned[0] ?? null;
};

const getTextSnippet = (element_: HTMLElement): string | null => {
    const snippet = getNearbyText(element_, 30);

    return snippet === "" ? null : snippet;
};

const generateId = (): string => `rs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const buildSection = (element_: HTMLElement, originalIndex: number): DetectedSection => {
    const { scrollY } = window;
    const rect = element_.getBoundingClientRect();
    const isFixed = isEffectivelyFixed(element_);
    const sectionRect = {
        height: rect.height,
        width: rect.width,
        x: rect.x,
        y: isFixed ? rect.y : rect.y + scrollY,
    };

    return {
        className: getCleanClassName(element_),
        currentRect: { ...sectionRect },
        id: generateId(),
        isFixed,
        label: labelSection(element_),
        originalIndex,
        originalRect: sectionRect,
        role: element_.getAttribute("role"),
        selector: generateSelector(element_),
        tagName: element_.tagName.toLowerCase(),
        textSnippet: getTextSnippet(element_),
    };
};

/**
 * Detect significant page sections for rearrange mode.
 */
export const detectPageSections = (): DetectedSection[] => {
    const main = document.querySelector("main") ?? document.body;
    const candidates = [...main.children] as HTMLElement[];
    const allCandidates = main !== document.body && candidates.length < 3
        ? ([...document.body.children] as HTMLElement[])
        : candidates;
    const sections: DetectedSection[] = [];

    allCandidates.forEach((element_, index) => {
        if (!(element_ instanceof HTMLElement)) {
            return;
        }

        const tag = element_.tagName.toLowerCase();

        if (SKIP_TAGS.has(tag) || element_.hasAttribute("data-feedback-toolbar") || element_.closest("[data-feedback-toolbar]")) {
            return;
        }

        const style = window.getComputedStyle(element_);

        if (style.display === "none" || style.visibility === "hidden") {
            return;
        }

        const rect = element_.getBoundingClientRect();

        if (rect.height < MIN_SECTION_HEIGHT) {
            return;
        }

        const isSemantic = SECTION_TAGS.has(tag);
        const role = element_.getAttribute("role");
        const hasRole = role !== null && SECTION_ROLES[role] !== undefined;
        const isSignificantDiv = tag === "div" && rect.height >= 60;

        if (!isSemantic && !hasRole && !isSignificantDiv) {
            return;
        }

        sections.push(buildSection(element_, index));
    });

    return sections;
};

/**
 * Create a DetectedSection from a single element (for click-to-capture).
 */
export const captureElement = (element_: HTMLElement): DetectedSection => {
    const parent = element_.parentElement;
    const originalIndex = parent ? [...parent.children].indexOf(element_) : 0;

    return buildSection(element_, originalIndex);
};
