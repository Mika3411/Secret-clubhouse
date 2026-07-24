import { installIsolatedTestDatabaseUrl } from "./test-database-safety.js";

installIsolatedTestDatabaseUrl(process.env);
await import("./run-retention.js");
