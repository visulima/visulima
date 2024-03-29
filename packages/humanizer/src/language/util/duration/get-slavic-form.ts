const getSlavicForm = (counter: number): number => {
    if (Math.floor(counter) !== counter) {
        return 2;
    }

    if ((counter % 100 >= 5 && counter % 100 <= 20) || (counter % 10 >= 5 && counter % 10 <= 9) || counter % 10 === 0) {
        return 0;
    }

    if (counter % 10 === 1) {
        return 1;
    }

    if (counter > 1) {
        return 2;
    }

    return 0;
};

export default getSlavicForm;
