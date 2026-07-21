/* eslint-disable @stylistic/no-extra-parens, react/function-component-definition */
import { strip } from "@visulima/ansi";
import { multilineGradient } from "@visulima/colorize/gradient";
import Box from "@visulima/tui/components/box";
import Text from "@visulima/tui/components/text";
import Transform from "@visulima/tui/components/transform";
import type { Key, ReactElement, ReactNode } from "react";
import { Children, cloneElement, isValidElement, useMemo } from "react";

/**
 * A color stop for the gradient — hex string, CSS color name, RGB tuple, RGB object, or positioned stop.
 */
type GradientStop = Parameters<typeof multilineGradient>[0][number];

/**
 * Built-in gradient presets.
 */
type GradientName = "atlas" | "cristal" | "fruit" | "instagram" | "mind" | "morning" | "pastel" | "passion" | "rainbow" | "retro" | "summer" | "teen" | "vice";

/**
 * Custom gradient colors — an array of color stops accepted by `@visulima/colorize`'s gradient API.
 */
type GradientColors = GradientStop[];

const presets: Record<GradientName, { colors: GradientStop[]; options?: { hsvSpin?: "long" | "short"; interpolation?: "hsv" | "rgb" } }> = {
    atlas: { colors: ["#feac5e", "#c779d0", "#4bc0c8"] },
    cristal: { colors: ["#bdfff3", "#4ac29a"] },
    fruit: { colors: ["#ff4e50", "#f9d423"] },
    instagram: { colors: ["#833ab4", "#fd1d1d", "#fcb045"] },
    mind: { colors: ["#473b7b", "#3584a7", "#30d2be"] },
    morning: { colors: ["#ff5f6d", "#ffc371"], options: { interpolation: "hsv" } },
    passion: { colors: ["#f43b47", "#453a94"] },
    pastel: { colors: ["#74ebd5", "#74ecd5"], options: { hsvSpin: "long", interpolation: "hsv" } },
    rainbow: { colors: ["#ff0000", "#ff0100"], options: { hsvSpin: "long", interpolation: "hsv" } },
    retro: { colors: ["#3f51b1", "#5a55ae", "#7b5fac", "#8f6aae", "#a86aa4", "#cc6b8e", "#f18271", "#f3a469", "#f7c978"] },
    summer: { colors: ["#fdbb2d", "#22c1c3"] },
    teen: { colors: ["#77a1d3", "#79cbca", "#e684ae"] },
    vice: { colors: ["#5ee7df", "#b490ca"], options: { interpolation: "hsv" } },
};

export type Props = {
    /**
     * The content to colorize.
     *
     * Multiple `&lt;Text>` children are treated as separate nodes, which preserves layout when `&lt;Gradient>` is placed inside a `&lt;Box flexDirection="column">`.
     *
     * If you want a continuous gradient across multiple lines, pass a single string or a single `&lt;Text>` with `\n`.
     */
    readonly children: ReactNode;

    /**
     * [Colors to use to make the gradient.](https://visulima.com/packages/colorize)
     *
     * Mutually exclusive with `name`.
     */
    readonly colors?: GradientColors;

    /**
     * The name of a built-in gradient preset.
     *
     * Mutually exclusive with `colors`.
     */
    readonly name?: GradientName;
};

/**
 * Apply a terminal gradient to child text content using `@visulima/colorize`.
 * @example
 * ```tsx
 * import { Gradient, Text } from "@visulima/tui/ink";
 *
 * <Gradient name="rainbow">
 *   <Text>Hello, World!</Text>
 * </Gradient>
 * ```
 */
const containsBoxDescendant = (nodeChildren: ReactNode): boolean => {
    let hasBox = false;

    const search = (value: ReactNode) => {
        // eslint-disable-next-line react-x/no-children-for-each
        Children.forEach(value, (child) => {
            if (hasBox) {
                return;
            }

            if (!isValidElement(child)) {
                return;
            }

            if (child.type === Box) {
                hasBox = true;

                return;
            }

            const childProps = child.props as Record<string, unknown>;

            if (Object.hasOwn(childProps, "children")) {
                search(childProps["children"] as ReactNode);
            }
        });
    };

    search(nodeChildren);

    return hasBox;
};

const hasChildrenProp = (properties: Record<string, unknown>) => Object.hasOwn(properties, "children");
const isPlainTextNode = (node: ReactNode): node is number | string => typeof node === "string" || typeof node === "number";
const isNonRenderableChild = (node: ReactNode) => node === null || node === undefined || typeof node === "boolean";

export default function Gradient({ children, colors, name }: Props): ReactElement | null {
    if (name && colors) {
        throw new Error("The `name` and `colors` props are mutually exclusive");
    }

    if (!name && !colors) {
        throw new Error("Either `name` or `colors` prop must be provided");
    }

    const gradientFunction = useMemo(
        () => (name ? multilineGradient(presets[name].colors, presets[name].options) : multilineGradient(colors ?? [])),
        [name, colors],
    );
    const applyGradient = (text: string) => gradientFunction(strip(text));
    // eslint-disable-next-line react-x/no-children-count
    const childrenCount = Children.count(children);

    if (isPlainTextNode(children)) {
        return <Transform transform={applyGradient}>{children}</Transform>;
    }

    if (childrenCount === 1 && !containsBoxDescendant(children)) {
        return <Transform transform={applyGradient}>{children}</Transform>;
    }

    const applyGradientToChildren = (nodeChildren: ReactNode): ReactNode => {
        const nodes: ReactNode[] = [];
        let bufferedText = "";
        let nodeIndex = 0;

        const createKey = () => {
            const key = `gradient-node-${String(nodeIndex)}`;

            nodeIndex += 1;

            return key;
        };

        const pushTransformed = (node: ReactNode, key: Key) => {
            nodes.push(
                <Transform key={key} transform={applyGradient}>
                    {node}
                </Transform>,
            );
        };

        const flushText = () => {
            if (bufferedText === "") {
                return;
            }

            const text = bufferedText;

            bufferedText = "";
            pushTransformed(<Text>{text}</Text>, createKey());
        };

        // eslint-disable-next-line react-x/no-children-for-each
        Children.forEach(nodeChildren, (child) => {
            if (isNonRenderableChild(child)) {
                return;
            }

            if (isPlainTextNode(child)) {
                bufferedText += String(child);

                return;
            }

            flushText();

            if (isValidElement(child)) {
                const childKey = child.key ?? createKey();
                const childProps = child.props as Record<string, unknown>;

                if (child.type === Text) {
                    pushTransformed(child, childKey);

                    return;
                }

                if (child.type === Box) {
                    if (hasChildrenProp(childProps)) {
                        const childChildren = childProps["children"] as ReactNode;

                        // eslint-disable-next-line react-x/no-clone-element
                        nodes.push(cloneElement(child, { key: childKey }, applyGradientToChildren(childChildren)));

                        return;
                    }

                    // eslint-disable-next-line react-x/no-clone-element
                    nodes.push(cloneElement(child, { key: childKey }));

                    return;
                }

                if (hasChildrenProp(childProps)) {
                    const childChildren = childProps["children"] as ReactNode;

                    if (!containsBoxDescendant(childChildren)) {
                        pushTransformed(child, childKey);

                        return;
                    }

                    // eslint-disable-next-line react-x/no-clone-element
                    nodes.push(cloneElement(child, { key: childKey }, applyGradientToChildren(childChildren)));

                    return;
                }

                pushTransformed(child, childKey);

                return;
            }

            nodes.push(child);
        });

        flushText();

        return nodes;
    };

    return <>{applyGradientToChildren(children)}</>;
}

export type { GradientColors, GradientName };

export { Gradient };
export type { Props as GradientProps };
