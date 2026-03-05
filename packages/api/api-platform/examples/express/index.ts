import express from "./express";

const PORT = process.env.PORT || 3002;
express.listen(PORT, () => console.log("listening on port:", PORT));
