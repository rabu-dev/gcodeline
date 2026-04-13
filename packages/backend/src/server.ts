import { createApp } from "./app.js";
import { getAppConfig } from "./config.js";

async function main() {
  const { app, eventBus, store } = await createApp();
  const appConfig = getAppConfig();

  eventBus.start();

  const server = app.listen(appConfig.port, () => {
    console.log(`GCodeLine backend listening on http://localhost:${appConfig.port}`);
  });

  process.on("SIGINT", async () => {
    eventBus.stop();
    server.close(async () => {
      await store.disconnect();
      process.exit(0);
    });
  });
}

void main();
