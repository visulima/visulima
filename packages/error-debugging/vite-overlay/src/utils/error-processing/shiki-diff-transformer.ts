import type { Element, ElementContent, ElementContentMap } from "hast";
import type { ShikiTransformer } from "shiki/types";

type Options = {
    classActivePre?: string;
    classLineAdd?: string;
    classLineRemove?: string;
};

const shikiDiffTransformer = (options: Options = {}): ShikiTransformer => {
    const { classActivePre = "has-diff", classLineAdd = "diff add", classLineRemove = "diff remove" } = options;

    return {
        code(node: Element) {
            this.addClassToHast(this.pre, classActivePre);

            const lines = node.children.filter((nodeChild: ElementContent) => nodeChild.type === "element") as Element[];

            lines.forEach((line) => {
                for (const child of line.children as Element[]) {
                    if (child.type !== "element") {
                        continue;
                    }

                    const text = child.children[0] as ElementContentMap["text"];

                    if (text.type !== "text") {
                        continue;
                    }

                    if (text.value.startsWith("[!code ++]")) {
                        text.value = text.value.slice(10);
                        this.addClassToHast(line, classLineAdd);
                    }

                    if (text.value.startsWith("[!code --]")) {
                        text.value = text.value.slice(10);
                        this.addClassToHast(line, classLineRemove);
                    }
                }
            });
        },
        name: "shiki-diff",
    };
};

export default shikiDiffTransformer;
