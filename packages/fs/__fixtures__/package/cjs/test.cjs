const { collect } = require("@visulima/fs");

(async () => {
    console.log(await collect("."));
})();
