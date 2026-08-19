"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

import { createExpense, updateExpense, type ExpenseActionState } from "./actions";
import { expenseCategories } from "./validation";

type Participant = { user_id: string; display_name: string; role: string };

type ExpenseFormProps = {
  expense?: {
    id: string;
    description: string;
    amount: string;
    currency: string;
    category: string;
    expense_date: string;
    payer_id: string;
  };
  participants: Participant[];
  tripId: string;
};

const initialState: ExpenseActionState = {};

const selectClass = "w-full [&>select]:h-11";

export function ExpenseForm({ expense, participants, tripId }: ExpenseFormProps) {
  const [state, formAction, pending] = useActionState(
    expense ? updateExpense : createExpense,
    initialState,
  );
  const fieldId = (name: string) => `expense-${expense?.id ?? "new"}-${name}`;

  return (
    <form action={formAction}>
      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="tripId" value={tripId} />
        {expense ? (
          <input type="hidden" name="expenseId" value={expense.id} />
        ) : null}

        <Field
          className="sm:col-span-2"
          data-invalid={Boolean(state.errors?.description)}
        >
          <FieldLabel htmlFor={fieldId("description")}>Description</FieldLabel>
          <Input
            required
            aria-invalid={Boolean(state.errors?.description)}
            className="h-11"
            defaultValue={expense?.description}
            id={fieldId("description")}
            maxLength={200}
            name="description"
            placeholder="Dinner reservation"
          />
          <FieldError>{state.errors?.description}</FieldError>
        </Field>

        <Field data-invalid={Boolean(state.errors?.amount)}>
          <FieldLabel htmlFor={fieldId("amount")}>Amount</FieldLabel>
          <Input
            required
            aria-invalid={Boolean(state.errors?.amount)}
            className="h-11"
            defaultValue={expense?.amount}
            id={fieldId("amount")}
            inputMode="decimal"
            max="999999999999.99"
            min="0.01"
            name="amount"
            step="0.01"
            type="number"
          />
          <FieldError>{state.errors?.amount}</FieldError>
        </Field>

        <Field data-invalid={Boolean(state.errors?.currency)}>
          <FieldLabel htmlFor={fieldId("currency")}>Currency</FieldLabel>
          <Input
            required
            aria-invalid={Boolean(state.errors?.currency)}
            className="h-11 uppercase"
            defaultValue={expense?.currency ?? "BRL"}
            id={fieldId("currency")}
            maxLength={3}
            minLength={3}
            name="currency"
            placeholder="BRL"
          />
          <FieldError>{state.errors?.currency}</FieldError>
        </Field>

        <Field data-invalid={Boolean(state.errors?.category)}>
          <FieldLabel htmlFor={fieldId("category")}>Category</FieldLabel>
          <NativeSelect
            required
            className={selectClass}
            defaultValue={expense?.category ?? "other"}
            id={fieldId("category")}
            name="category"
          >
            {expenseCategories.map((category) => (
              <NativeSelectOption key={category} value={category}>
                {category[0].toUpperCase() + category.slice(1)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldError>{state.errors?.category}</FieldError>
        </Field>

        <Field data-invalid={Boolean(state.errors?.date)}>
          <FieldLabel htmlFor={fieldId("date")}>Date</FieldLabel>
          <Input
            required
            aria-invalid={Boolean(state.errors?.date)}
            className="h-11"
            defaultValue={expense?.expense_date}
            id={fieldId("date")}
            name="date"
            type="date"
          />
          <FieldError>{state.errors?.date}</FieldError>
        </Field>

        <Field className="sm:col-span-2" data-invalid={Boolean(state.errors?.payer)}>
          <FieldLabel htmlFor={fieldId("payer")}>Payer</FieldLabel>
          <NativeSelect
            required
            className={selectClass}
            defaultValue={expense?.payer_id ?? ""}
            id={fieldId("payer")}
            name="payerId"
          >
            <NativeSelectOption disabled value="">
              Choose a participant
            </NativeSelectOption>
            {participants.map((participant) => (
              <NativeSelectOption
                key={participant.user_id}
                value={participant.user_id}
              >
                {participant.display_name} ({participant.role})
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldError>{state.errors?.payer}</FieldError>
        </Field>

        {state.message ? (
          <Alert
            variant="destructive"
            className="bg-destructive-muted sm:col-span-2"
          >
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
        {state.success ? (
          <p className="text-sm text-success sm:col-span-2">
            {expense ? "Expense updated." : "Expense added."}
          </p>
        ) : null}

        <Button
          disabled={pending}
          size="lg"
          className="h-11 px-5 text-base font-semibold sm:col-span-2 sm:justify-self-start"
        >
          {pending ? "Saving..." : expense ? "Save changes" : "Add expense"}
        </Button>
      </FieldGroup>
    </form>
  );
}
