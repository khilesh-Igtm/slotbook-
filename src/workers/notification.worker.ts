import { config } from "dotenv";
config(); // Load environment variables from .env

import {
  claimDueNotifications,
  processNotification,
} from "@/lib/notifications/notification.service";
import { prisma } from "@/lib/prisma";

const POLL_INTERVAL_MS = parseInt(process.env.NOTIFICATION_POLL_INTERVAL_MS || "5000", 10);
const LOCK_TIMEOUT_MS = parseInt(process.env.NOTIFICATION_LOCK_TIMEOUT_MS || "300000", 10);
const BATCH_SIZE = 10;
const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || "console";

let isRunning = true;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWorkerLoop() {
  console.log("==================================================");
  console.log("⚡ Slotbook Notification Background Worker");
  console.log("==================================================");
  console.log(`Provider:        ${EMAIL_PROVIDER}`);
  console.log(`Poll Interval:   ${POLL_INTERVAL_MS}ms`);
  console.log(`Batch Size:      ${BATCH_SIZE}`);
  console.log(`Lock Lease:      ${LOCK_TIMEOUT_MS}ms`);
  console.log(`Process PID:     ${process.pid}`);
  console.log("Worker listening for due notifications...\n");

  while (isRunning) {
    try {
      // 1. Claim due or stale notifications
      const claimedIds = await claimDueNotifications(BATCH_SIZE, LOCK_TIMEOUT_MS);

      if (claimedIds.length > 0) {
        console.log(`[WORKER] Claimed ${claimedIds.length} due notification job(s): [${claimedIds.join(", ")}]`);

        // 2. Process each claimed notification safely outside database transaction
        for (const id of claimedIds) {
          if (!isRunning) break;

          try {
            const result = await processNotification(id);
            if (result.success) {
              console.log(`[WORKER] Successfully processed notification ${id} -> Status: ${result.status}`);
            } else {
              console.warn(`[WORKER] Failed to process notification ${id} -> Status: ${result.status} | Error: ${result.error}`);
            }
          } catch (jobErr: unknown) {
            console.error(`[WORKER] Uncaught error processing notification ${id}:`, jobErr);
          }
        }

        // If a full batch was processed, poll quickly for next batch
        if (claimedIds.length === BATCH_SIZE) {
          await sleep(250);
          continue;
        }
      }

      // No jobs claimed, wait for next polling cycle
      await sleep(POLL_INTERVAL_MS);
    } catch (pollErr: unknown) {
      console.error("[WORKER] Error in polling cycle:", pollErr);
      await sleep(POLL_INTERVAL_MS);
    }
  }

  console.log("[WORKER] Worker loop terminated cleanly.");
  await prisma.$disconnect();
  process.exit(0);
}

// Graceful shutdown handlers
function handleShutdown(signal: string) {
  if (!isRunning) return;
  console.log(`\n[WORKER] Received ${signal}. Initiating graceful shutdown...`);
  isRunning = false;
}

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));

// Execute the worker loop
runWorkerLoop().catch((err) => {
  console.error("[WORKER] Fatal worker error:", err);
  process.exit(1);
});

