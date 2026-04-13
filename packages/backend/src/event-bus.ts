import { AppStore } from "./store.js";

export class EventBus {
  private timer?: NodeJS.Timeout;

  constructor(private store: AppStore) {}

  publish(eventName: string, payload: Record<string, unknown>, delayMs = 0) {
    return this.store.enqueueEvent(eventName, payload, delayMs);
  }

  start() {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.processNext();
    }, 250);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async processNext() {
    const job = await this.store.reserveNextEvent();
    if (!job) {
      return;
    }

    try {
      if (job.eventName === "build.requested") {
        const buildId = String(job.payload.buildId);
        await this.store.updateBuildStatus(buildId, "running");
        await new Promise((resolve) => setTimeout(resolve, 150));
        await this.store.updateBuildStatus(buildId, "passed");
      }

      if (job.eventName === "notification.emit") {
        await this.store.createNotification(
          String(job.payload.userId),
          String(job.payload.kind),
          String(job.payload.title),
          String(job.payload.body)
        );
      }

      await this.store.completeEvent(job.id);
    } catch {
      await this.store.failEvent(job.id);
    }
  }
}
