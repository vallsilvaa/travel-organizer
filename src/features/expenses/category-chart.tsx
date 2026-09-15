"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type ExpenseCategoryChartDatum = {
  category: string;
  amount: number;
};

export function ExpenseCategoryChart({
  data,
  currency,
  chartLabel,
  formatAmount,
}: {
  data: ExpenseCategoryChartDatum[];
  currency: string;
  chartLabel: string;
  formatAmount: (amount: number, currency: string) => string;
}) {
  return (
    <div className="h-64 w-full" role="img" aria-label={chartLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="category"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            interval={0}
            angle={-20}
            textAnchor="end"
            height={48}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            formatter={(value) => [formatAmount(Number(value ?? 0), currency), null]}
            contentStyle={{
              borderRadius: 8,
              borderColor: "var(--border)",
              backgroundColor: "var(--popover)",
              color: "var(--popover-foreground)",
              fontSize: 12,
            }}
          />
          <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
