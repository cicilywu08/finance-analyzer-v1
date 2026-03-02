"use client";

import { useState } from "react";
import { CategorizationBlock } from "./CategorizationBlock";
import { FinancialInsights } from "./FinancialInsights";
import { TransactionList } from "./TransactionList";

interface MonthDetailClientProps {
  yearMonth: string;
}

export function MonthDetailClient({ yearMonth }: MonthDetailClientProps) {
  const [dataRefreshKey, setDataRefreshKey] = useState(0);

  return (
    <>
      <CategorizationBlock
        yearMonth={yearMonth}
        onClassificationComplete={() => setDataRefreshKey((k) => k + 1)}
      />
      <FinancialInsights yearMonth={yearMonth} refreshKey={dataRefreshKey} />
      <TransactionList yearMonth={yearMonth} refreshKey={dataRefreshKey} />
    </>
  );
}
