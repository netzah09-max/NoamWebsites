require("dotenv").config();

const { server } = require("./index.js");

const port = Number.parseInt(process.env.PORT || "3000", 10);

server.listen(port, "0.0.0.0", () => {
  console.log(`NoamWebsites Bot API listening on port ${port}`);
});
