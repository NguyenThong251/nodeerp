const { MeiliSearch } = require("meilisearch");

const meiliClient = new MeiliSearch({
  host: "http://127.0.0.1:7700",
  apiKey: "Gteu6CJyxrzPgZxRRzbBCmkBH4SmZ4qz",
});

module.exports = meiliClient;
