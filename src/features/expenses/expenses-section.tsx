import { ReceiptTextIcon, WalletIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import type { TripExpense, TripSectionProps } from "@/features/trips/types";
import { formatDate, formatMoney } from "@/lib/format";

import { deleteExpense } from "./actions";
import { ExpenseForm } from "./expense-form";

type ExpensesSectionProps = TripSectionProps & {
  error: boolean;
  expenses: TripExpense[];
  totalsByCurrency: Array<[string, number]>;
};

export function ExpensesSection({
  error,
  expenses,
  participantNames,
  participants,
  totalsByCurrency,
  tripId,
}: ExpensesSectionProps) {
  return (
    <div className="space-y-6">
      {totalsByCurrency.length ? (
        <dl className="grid gap-3 sm:grid-cols-3">
          {totalsByCurrency.map(([currency, total]) => (
            <div
              key={currency}
              className="rounded-2xl border border-success/20 bg-success-muted p-4"
            >
              <dt className="text-xs font-semibold tracking-wide text-success uppercase">
                Total {currency}
              </dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums text-success">
                {formatMoney(total, currency)}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <details
        className="rounded-2xl border border-border bg-card p-5"
        open={!expenses.length}
      >
        <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-foreground">
          <ReceiptTextIcon className="size-4.5 text-primary" />
          Add expense
        </summary>
        <div className="mt-5">
          <ExpenseForm participants={participants} tripId={tripId} />
        </div>
      </details>

      {error ? (
        <Alert variant="destructive" className="bg-destructive-muted">
          <AlertDescription>
            We could not load the expenses. Try refreshing the page.
          </AlertDescription>
        </Alert>
      ) : expenses.length ? (
        <ul className="space-y-4">
          {expenses.map((expense) => (
            <li
              key={expense.id}
              className="rounded-2xl border border-border bg-card p-5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-foreground">
                      {expense.description}
                    </h3>
                    <Badge variant="secondary" className="capitalize">
                      {expense.category}
                    </Badge>
                  </div>
                  <p className="mt-2 text-lg font-semibold tabular-nums text-success">
                    {formatMoney(expense.amount, expense.currency)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Paid by {participantNames.get(expense.payer_id) ?? "Traveler"}{" "}
                    · {formatDate(expense.expense_date)}
                  </p>
                </div>
                <form action={deleteExpense}>
                  <input type="hidden" name="tripId" value={tripId} />
                  <input type="hidden" name="expenseId" value={expense.id} />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10"
                  >
                    Delete
                  </Button>
                </form>
              </div>

              <Separator className="mt-4" />
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-semibold text-primary">
                  Edit expense
                </summary>
                <div className="mt-4">
                  <ExpenseForm
                    expense={expense}
                    participants={participants}
                    tripId={tripId}
                  />
                </div>
              </details>
            </li>
          ))}
        </ul>
      ) : (
        <Empty className="rounded-2xl border border-dashed border-input">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <WalletIcon />
            </EmptyMedia>
            <EmptyTitle>No expenses yet</EmptyTitle>
            <EmptyDescription>
              Add the first shared cost to start tracking totals per currency.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}
