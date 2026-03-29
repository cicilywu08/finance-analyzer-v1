/**
 * Run inline detection test: Payment Due Date:03/22/26 → 2026-02, payment_due_date_fallback_adjusted.
 * Run with: npm run test:detect
 */
import { runDetectionDueDateTest } from "../lib/parser";

runDetectionDueDateTest()
  .then(() => console.log("OK: detection test passed"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
