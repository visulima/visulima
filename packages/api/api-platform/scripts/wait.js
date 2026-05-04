const waitNSeconds = async (seconds) =>
    new Promise((resolve) => {
        setTimeout(() => {
            resolve("n seconds have passed");
        }, seconds);
    });

waitNSeconds(4000);
