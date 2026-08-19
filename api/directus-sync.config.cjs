const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

module.exports = {
  debug: process.env.DIRECTUS_SYNC_DEBUG === "true",
  directusUrl:
    process.env.DIRECTUS_URL ||
    `http://localhost:${process.env.DIRECTUS_PORT || "18707"}`,
  directusEmail: process.env.ADMIN_EMAIL,
  directusPassword: process.env.ADMIN_PASSWORD,
  dumpPath: path.resolve(__dirname, "directus-config"),
  collectionsPath: "collections",
  snapshotPath: "snapshot",
  seedPath: path.resolve(__dirname, "directus-config/seed"),
  split: true,
  specs: false,
  maxPushRetries: 10,
};

