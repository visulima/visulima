const waitNSeconds = async (seconds) => {
    // eslint-disable-next-line compat/compat
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve("n seconds have passed");
        }, seconds);
    });
};

waitNSeconds(4000);
