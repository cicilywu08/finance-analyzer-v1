import { extractPdfText, detectStatementPeriod, parseChaseTransactions, parseBoaTransactions, parseAmexTransactions } from "@/lib/parser";
import { saveTransactions } from "@/lib/db";

export const dynamic = "force-dynamic";

const MAX_FILES = 12;
const HEADER_TEXT_LENGTH = 6000;
const PREVIEW_TRANSACTIONS = 10;
const PREVIEW_FAILURES = 20;

export type PreviewTransaction = {
  date: string;
  merchant_raw: string;
  amount: number;
  exchangeRateMetadata?: string;
};

export type UploadResultItem = {
  filename: string;
  status: "ok" | "error";
  detectedYearMonth: string | null;
  transactionCount: number;
  parseFailureCount: number;
  previewTransactions: PreviewTransaction[];
  failuresPreview: string[];
  error?: string;
};

export async function POST(request: Request): Promise<Response> {
  try {
    const formData = await request.formData();
    const entries = formData.getAll("files");
    const files = Array.isArray(entries) ? entries : entries ? [entries] : [];
    const fileList = files.filter(
      (f): f is File => f instanceof File && f.name.endsWith(".pdf")
    );

    if (fileList.length === 0) {
      return Response.json(
        { error: "No PDF files provided. Use form field 'files'." },
        { status: 400 }
      );
    }
    if (fileList.length > MAX_FILES) {
      return Response.json(
        { error: `Maximum ${MAX_FILES} files allowed.` },
        { status: 400 }
      );
    }

    const dbWriteEnabled =
      process.env.ENABLE_DB_WRITE === "true" && !!process.env.DATABASE_URL;

    const results: UploadResultItem[] = [];

    for (const file of fileList) {
      const filename = file.name ?? "unknown.pdf";
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const { text, isScanned } = await extractPdfText(buffer);

        if (isScanned || !text) {
          results.push({
            filename,
            status: "error",
            detectedYearMonth: null,
            transactionCount: 0,
            parseFailureCount: 0,
            previewTransactions: [],
            failuresPreview: [],
            error: "Scanned PDF not supported.",
          });
          continue;
        }

        const headerText = text.slice(0, HEADER_TEXT_LENGTH);
        const detection = await detectStatementPeriod(headerText);
        const detectedYearMonth =
          detection.year != null && detection.month != null
            ? `${detection.year}-${String(detection.month).padStart(2, "0")}`
            : null;

        let transactionCount = 0;
        let parseFailureCount = 0;
        let previewTransactions: PreviewTransaction[] = [];
        let failuresPreview: string[] = [];

        if (detectedYearMonth) {
          const isAmex =
            /american\s+express|amex\b/i.test(headerText) ||
            /american\s+express|amex\b/i.test(text.slice(0, 8000));
          const isBoa =
            /bank of america|boa\b/i.test(headerText) ||
            /bank of america|boa\b/i.test(text.slice(0, 12000));
          const parseResult = isAmex
            ? parseAmexTransactions(text, detectedYearMonth)
            : isBoa
              ? parseBoaTransactions(text, detectedYearMonth)
              : parseChaseTransactions(text, detectedYearMonth);
          transactionCount = parseResult.transactions.length;
          parseFailureCount = parseResult.failures.length;
          previewTransactions = parseResult.transactions
            .slice(0, PREVIEW_TRANSACTIONS)
            .map((t) => ({
              date: t.date,
              merchant_raw: t.merchant_raw,
              amount: t.amount,
              ...(t.exchangeRateMetadata && {
                exchangeRateMetadata: t.exchangeRateMetadata,
              }),
            }));
          failuresPreview = parseResult.failures.slice(0, PREVIEW_FAILURES);

          if (dbWriteEnabled) {
            try {
              const [y, m] = detectedYearMonth.split("-").map(Number);
              // If no transactions were parsed, insert a placeholder so the month still appears in the dashboard.
              const toSave =
                parseResult.transactions.length > 0
                  ? parseResult.transactions
                  : [
                      {
                        date: `${y}-${String(m).padStart(2, "0")}-01`,
                        merchant_raw: "(Statement imported – no transactions parsed)",
                        amount: 0,
                        currency: undefined as string | undefined,
                        exchangeRateMetadata: undefined as string | undefined,
                      },
                    ];
              await saveTransactions(y, m, toSave);
            } catch (dbErr) {
              console.error("[upload] Failed to store transactions", dbErr);
              results.push({
                filename,
                status: "error",
                detectedYearMonth,
                transactionCount,
                parseFailureCount,
                previewTransactions,
                failuresPreview,
                error:
                  dbErr instanceof Error
                    ? dbErr.message
                    : "Failed to store transactions in Postgres.",
              });
              continue;
            }
          }
        }

        results.push({
          filename,
          status: "ok",
          detectedYearMonth,
          transactionCount,
          parseFailureCount,
          previewTransactions,
          failuresPreview,
        });
      } catch (err) {
        results.push({
          filename,
          status: "error",
          detectedYearMonth: null,
          transactionCount: 0,
          parseFailureCount: 0,
          previewTransactions: [],
          failuresPreview: [],
          error: err instanceof Error ? err.message : "Processing failed.",
        });
      }
    }

    return Response.json(results);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Upload failed." },
      { status: 500 }
    );
  }
}
