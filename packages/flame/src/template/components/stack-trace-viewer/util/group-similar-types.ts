import type { Item } from "../types";

type Grouped = Item | Item[];

const groupSimilarTypes = (list: Item[]): Grouped[] => {
    const result: Grouped[] = [];
    let currentGroup: Item[] = [];

    for (let index = 0; index < list.length; index += 1) {
        currentGroup.push(list[index] as Item);

        const isEndOfList = index === list.length - 1;
        const nextHasDifferentType = !isEndOfList && (list[index] as Item).type !== (list[index + 1] as Item).type;

        if (isEndOfList || nextHasDifferentType) {
            if (currentGroup.length > 1) {
                result.push(currentGroup);
            } else {
                result.push(currentGroup[0] as Item);
            }

            currentGroup = [];
        }
    }

    return result;
};

export default groupSimilarTypes;
