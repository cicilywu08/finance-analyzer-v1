"use client";

import { useState } from "react";
import { FinancialInsights } from "./FinancialInsights";
import { TransactionList } from "./TransactionList";

interface MonthDetailClientProps {
  yearMonth: string;
}

export function MonthDetailClient({ yearMonth }: MonthDetailClientProps) {
  const [dataRefreshKey, setDataRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      <FinancialInsights
        yearMonth={yearMonth}
        refreshKey={dataRefreshKey}
        onClassificationComplete={() => setDataRefreshKey((k) => k + 1)}
      />
      <div id="transactions">
        <TransactionList yearMonth={yearMonth} refreshKey={dataRefreshKey} />
      </div>
    </div>
  );
}
