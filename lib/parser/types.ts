export interface ParsedTransaction {
  date: string;
  merchant_raw: string;
  amount: number;
  currency?: string;
  exchangeRateMetadata?: string;
}
