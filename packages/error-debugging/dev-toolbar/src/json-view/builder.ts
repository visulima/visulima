import type { UIElement } from "./catalog";

/**
 * Collects spec elements under generated keys.
 *
 * A spec builder names relationships, not elements, so the keys are an
 * implementation detail — handing them out on `add` keeps a builder from
 * inventing a naming scheme per panel.
 */
export interface Builder<Element extends UIElement> {
    /** Register an element and get the key that refers to it. */
    add: (element: Element) => string;

    /** The elements registered so far, keyed for the spec. */
    elements: Record<string, Element>;
}

export const createBuilder = <Element extends UIElement>(): Builder<Element> => {
    const elements: Record<string, Element> = {};
    let counter = 0;

    const add = (element: Element): string => {
        counter += 1;

        const key = `e${counter}`;

        elements[key] = element;

        return key;
    };

    return { add, elements };
};
