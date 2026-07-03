import type { Node as YogaNode } from "yoga-layout";
import Yoga from "yoga-layout";

const getMaxWidth = (yogaNode: YogaNode): number =>
    Math.round(
        yogaNode.getComputedWidth()
        - Math.max(0, yogaNode.getComputedLeft() + yogaNode.getComputedWidth() - (yogaNode.getParent()?.getComputedWidth() ?? yogaNode.getComputedWidth()))
        - yogaNode.getComputedPadding(Yoga.EDGE_LEFT)
        - yogaNode.getComputedPadding(Yoga.EDGE_RIGHT)
        - yogaNode.getComputedBorder(Yoga.EDGE_LEFT)
        - yogaNode.getComputedBorder(Yoga.EDGE_RIGHT),
    );

export default getMaxWidth;
