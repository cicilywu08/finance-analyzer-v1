/**
 * Test Amex parsing on a template PDF. Run: npx tsx scripts/test-amex-parse.ts
 * Expects PDF path in first arg or uses 2023-02-13.pdf in Downloads.
 */
import * as fs from "fs";
import * as path from "path";
import { extractPdfText, detectStatementPeriod, parseAmexTransactions } from "../lib/parser";

const pdfPath =
  process.argv[2] ??
  path.join(process.env.HOME || "", "Downloads", "2023-02-13.pdf");

async function main() {
  if (!fs.existsSync(pdfPath)) {
    console.error("PDF not found:", pdfPath);
    process.exit(1);
  }
  const buffer = fs.readFileSync(pdfPath);
  const { text, isScanned } = await extractPdfText(buffer);
  if (isScanned || !text) {
    console.error("Could not extract text (scanned or empty)");
    process.exit(1);
  }
  const headerText = text.slice(0, 4000);
  const detection = await detectStatementPeriod(headerText);
  const detectedYearMonth =
    detection.year != null && detection.month != null
      ? `${detection.year}-${String(detection.month).padStart(2, "0")}`
      : null;
  console.log("Detection:", detection.detectionSource, "→", detectedYearMonth);

  if (!detectedYearMonth) {
    console.error("No period detected");
    process.exit(1);
  }

  const result = parseAmexTransactions(text, detectedYearMonth);
  console.log("Transactions:", result.transactions.length);
  console.log("Failures:", result.failures.length);
  result.transactions.slice(0, 12).forEach((t, i) => {
    console.log(`  ${i + 1}. ${t.date} | ${t.merchant_raw.slice(0, 50)} | ${t.amount}`);
  });
  if (result.failures.length > 0) {
    console.log("Sample failures:", result.failures.slice(0, 3));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
