import type { Item } from "../types";

const groupSimilarTypes = (list: Item[]): (Item | Item[])[] => {
    const result: any[] = [];
    let currentGroup: Item[] = [];

    for (let i = 0; i < list.length; i++) {
        // Add the current item to the group
        currentGroup.push(list[i] as Item);

        // Check if the next item is different or if we are at the end of the list
        if (i === list.length - 1 || (list[i] as Item).type !== (list[i + 1] as Item).type) {
            if (currentGroup.length > 1) {
                // If the group has more than one item, add it as a sub-array
                result.push(currentGroup);
            } else {
                // Otherwise, add the single item
                result.push(...currentGroup);
            }
            // Reset the group for the next items
            currentGroup = [];
        }
    }

    return result;
};

export default groupSimilarTypes;
