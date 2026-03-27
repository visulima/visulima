import renderNodeToOutput, { renderNodeToScreenReaderOutput } from "./render-node-to-output.js";
import Output, { OutputCaches } from "./output.js";
import { type DOMElement } from "./dom.js";

type Result = {
    output: string;
    outputHeight: number;
    staticOutput: string;
};

const interactiveOutputCaches = new OutputCaches();
const staticOutputCaches = new OutputCaches();
const interactiveOutputs = new WeakMap<DOMElement, Output>();
const staticOutputs = new WeakMap<DOMElement, Output>();

type ReusableOutputOptions = {
    outputs: WeakMap<DOMElement, Output>;
    node: DOMElement;
    width: number;
    height: number;
    caches: OutputCaches;
};

const getReusableOutput = ({ outputs, node, width, height, caches }: ReusableOutputOptions): Output => {
    let output = outputs.get(node);
    if (!output) {
        output = new Output({
            width,
            height,
            caches,
        });
        outputs.set(node, output);
    }

    output.reset(width, height);
    return output;
};

const renderer = (node: DOMElement, isScreenReaderEnabled: boolean): Result => {
    if (node.yogaNode) {
        if (isScreenReaderEnabled) {
            const output = renderNodeToScreenReaderOutput(node, {
                skipStaticElements: true,
            });

            const outputHeight = output === "" ? 0 : output.split("\n").length;

            let staticOutput = "";

            if (node.staticNode) {
                staticOutput = renderNodeToScreenReaderOutput(node.staticNode, {
                    skipStaticElements: false,
                });
            }

            return {
                output,
                outputHeight,
                staticOutput: staticOutput ? `${staticOutput}\n` : "",
            };
        }

        const output = getReusableOutput({
            outputs: interactiveOutputs,
            node,
            width: node.yogaNode.getComputedWidth(),
            height: node.yogaNode.getComputedHeight(),
            caches: interactiveOutputCaches,
        });

        renderNodeToOutput(node, output, {
            skipStaticElements: true,
        });

        let staticOutput;

        if (node.staticNode?.yogaNode) {
            staticOutput = getReusableOutput({
                outputs: staticOutputs,
                node,
                width: node.staticNode.yogaNode.getComputedWidth(),
                height: node.staticNode.yogaNode.getComputedHeight(),
                caches: staticOutputCaches,
            });

            renderNodeToOutput(node.staticNode, staticOutput, {
                skipStaticElements: false,
            });
        }

        const { output: generatedOutput, height: outputHeight } = output.get();

        return {
            output: generatedOutput,
            outputHeight,
            // Newline at the end is needed, because static output doesn't have one, so
            // interactive output will override last line of static output
            staticOutput: staticOutput ? `${staticOutput.get().output}\n` : "",
        };
    }

    return {
        output: "",
        outputHeight: 0,
        staticOutput: "",
    };
};

export default renderer;
