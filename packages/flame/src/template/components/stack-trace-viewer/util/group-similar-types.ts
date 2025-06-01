import type { Item } from "../types";

const groupSimilarTypes = (list: Item[]): (Item | Item[])[] => {
    const result: any[] = [];
    let currentGroup: Item[] = [];

    for (let index = 0; index < list.length; index++) {
        // Add the current item to the group
        currentGroup.push(list[index] as Item);

        // Check if the next item is different or if we are at the end of the list
        if (index === list.length - 1 || (list[index] as Item).type !== (list[index + 1] as Item).type) {
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
