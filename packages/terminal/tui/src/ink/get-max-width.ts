import type { Node as YogaNode } from "yoga-layout";
import Yoga from "yoga-layout";

const getMaxWidth = (yogaNode: YogaNode): number =>
    yogaNode.getComputedWidth()
    - yogaNode.getComputedPadding(Yoga.EDGE_LEFT)
    - yogaNode.getComputedPadding(Yoga.EDGE_RIGHT)
    - yogaNode.getComputedBorder(Yoga.EDGE_LEFT)
    - yogaNode.getComputedBorder(Yoga.EDGE_RIGHT);

export default getMaxWidth;
