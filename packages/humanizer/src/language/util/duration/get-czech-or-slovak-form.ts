const getCzechOrSlovakForm = (counter: number): number => {
    if (counter === 1) {
        return 0;
    }

    if (Math.floor(counter) !== c) {
        return 1;
    }

    if (counter % 10 >= 2 && c % 10 <= 4 && c % 100 < 10) {
        return 2;
    }

    return 3;
};

export default getCzechOrSlovakForm;
