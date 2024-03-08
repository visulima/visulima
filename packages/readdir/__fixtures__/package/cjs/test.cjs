const { collect } = require("@visulima/readdir");

(async () => {
    console.log(await collect("."));
})();
