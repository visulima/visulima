const { collect } = require("@visulima/fs");

(async () => {
    console.log(await collect("./__fixtures__/find-up"));
})();
