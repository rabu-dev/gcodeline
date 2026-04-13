import { createApp } from "./app.js";
import { getAppConfig } from "./config.js";

const { app, eventBus } = createApp();
const appConfig = getAppConfig();

eventBus.start();

const server = app.listen(appConfig.port, () => {
  console.log(`GCodeLine backend listening on http://localhost:${appConfig.port}`);
});

process.on("SIGINT", () => {
  eventBus.stop();
  server.close(() => process.exit(0));
});
