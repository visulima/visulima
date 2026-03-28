/* eslint-disable sonarjs/cognitive-complexity */
import type { DOMElement } from "./dom";
import type { CursorPosition } from "./log-update";
import Output, { OutputCaches } from "./output";
import renderNodeToOutput, { renderNodeToScreenReaderOutput, type RenderState } from "./render-node-to-output";

type Result = {
    cursorPosition: CursorPosition | undefined;
    cursorRequested: boolean;
    output: string;
    outputHeight: number;
    staticOutput: string;
};

const interactiveOutputCaches = new OutputCaches();
const staticOutputCaches = new OutputCaches();
const interactiveOutputs = new WeakMap<DOMElement, Output>();
const staticOutputs = new WeakMap<DOMElement, Output>();

type ReusableOutputOptions = {
    caches: OutputCaches;
    height: number;
    node: DOMElement;
    outputs: WeakMap<DOMElement, Output>;
    width: number;
};

const getReusableOutput = ({ caches, height, node, outputs, width }: ReusableOutputOptions): Output => {
    let output = outputs.get(node);

    if (!output) {
        output = new Output({
            caches,
            height,
            width,
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
                cursorPosition: undefined,
                cursorRequested: false,
                output,
                outputHeight,
                staticOutput: staticOutput ? `${staticOutput}\n` : "",
            };
        }

        const output = getReusableOutput({
            caches: interactiveOutputCaches,
            height: node.yogaNode.getComputedHeight(),
            node,
            outputs: interactiveOutputs,
            width: node.yogaNode.getComputedWidth(),
        });

        const renderState: RenderState = {
            cursorPosition: undefined,
            cursorRequested: false,
        };

        renderNodeToOutput(node, output, {
            renderState,
            skipStaticElements: true,
        });

        let staticOutput;

        if (node.staticNode?.yogaNode) {
            staticOutput = getReusableOutput({
                caches: staticOutputCaches,
                height: node.staticNode.yogaNode.getComputedHeight(),
                node,
                outputs: staticOutputs,
                width: node.staticNode.yogaNode.getComputedWidth(),
            });

            renderNodeToOutput(node.staticNode, staticOutput, {
                skipStaticElements: false,
            });
        }

        const { height: outputHeight, output: generatedOutput } = output.get();

        return {
            output: generatedOutput,
            outputHeight,
            // Newline at the end is needed, because static output doesn't have one, so
            // interactive output will override last line of static output
            staticOutput: staticOutput ? `${staticOutput.get().output}\n` : "",
            cursorRequested: renderState.cursorRequested,
            cursorPosition: renderState.cursorPosition,
        };
    }

    return {
        cursorPosition: undefined,
        cursorRequested: false,
        output: "",
        outputHeight: 0,
        staticOutput: "",
    };
};

export default renderer;
