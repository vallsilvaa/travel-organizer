export type ParticipantBalance = {
  userId: string;
  displayName: string;
  currency: string;
  totalPaid: string;
  totalOwed: string;
  netBalance: string;
};

export type Settlement = {
  fromUserId: string;
  fromDisplayName: string;
  toUserId: string;
  toDisplayName: string;
  currency: string;
  amount: string;
};

function toCents(value: string) {
  return Math.round(Number(value) * 100);
}

function fromCents(cents: number) {
  return (cents / 100).toFixed(2);
}

/**
 * Suggests who should pay whom to settle every balance, one currency at a
 * time (no conversion between currencies). Uses the standard greedy
 * largest-debtor-to-largest-creditor match: not guaranteed to produce the
 * fewest possible transactions, but it's simple, deterministic, and every
 * balance always reaches exactly zero.
 */
export function computeSettlements(balances: ParticipantBalance[]): Settlement[] {
  const byCurrency = new Map<string, ParticipantBalance[]>();
  for (const balance of balances) {
    const group = byCurrency.get(balance.currency) ?? [];
    group.push(balance);
    byCurrency.set(balance.currency, group);
  }

  const settlements: Settlement[] = [];

  for (const [currency, group] of byCurrency) {
    type Ledger = { userId: string; displayName: string; cents: number };
    const debtors: Ledger[] = [];
    const creditors: Ledger[] = [];

    for (const balance of group) {
      const cents = toCents(balance.netBalance);
      if (cents < 0) {
        debtors.push({ userId: balance.userId, displayName: balance.displayName, cents: -cents });
      } else if (cents > 0) {
        creditors.push({ userId: balance.userId, displayName: balance.displayName, cents });
      }
    }

    debtors.sort((a, b) => b.cents - a.cents);
    creditors.sort((a, b) => b.cents - a.cents);

    let debtorIndex = 0;
    let creditorIndex = 0;
    while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
      const debtor = debtors[debtorIndex];
      const creditor = creditors[creditorIndex];
      const amountCents = Math.min(debtor.cents, creditor.cents);

      if (amountCents > 0) {
        settlements.push({
          fromUserId: debtor.userId,
          fromDisplayName: debtor.displayName,
          toUserId: creditor.userId,
          toDisplayName: creditor.displayName,
          currency,
          amount: fromCents(amountCents),
        });
      }

      debtor.cents -= amountCents;
      creditor.cents -= amountCents;
      if (debtor.cents === 0) {
        debtorIndex += 1;
      }
      if (creditor.cents === 0) {
        creditorIndex += 1;
      }
    }
  }

  return settlements;
}
