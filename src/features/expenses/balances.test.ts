import { describe, expect, it } from "vitest";

import { computeSettlements, type ParticipantBalance } from "./balances";

function balance(overrides: Partial<ParticipantBalance>): ParticipantBalance {
  return {
    userId: "user",
    displayName: "User",
    currency: "BRL",
    totalPaid: "0.00",
    totalOwed: "0.00",
    netBalance: "0.00",
    ...overrides,
  };
}

describe("computeSettlements", () => {
  it("suggests a single transaction for a simple two-person split", () => {
    const settlements = computeSettlements([
      balance({ userId: "ana", displayName: "Ana", netBalance: "20.00" }),
      balance({ userId: "bruno", displayName: "Bruno", netBalance: "-20.00" }),
    ]);

    expect(settlements).toEqual([
      {
        fromUserId: "bruno",
        fromDisplayName: "Bruno",
        toUserId: "ana",
        toDisplayName: "Ana",
        currency: "BRL",
        amount: "20.00",
      },
    ]);
  });

  it("ignores participants who are already settled up", () => {
    const settlements = computeSettlements([
      balance({ userId: "ana", displayName: "Ana", netBalance: "0.00" }),
      balance({ userId: "bruno", displayName: "Bruno", netBalance: "10.00" }),
      balance({ userId: "caio", displayName: "Caio", netBalance: "-10.00" }),
    ]);

    expect(settlements).toHaveLength(1);
    expect(settlements[0].fromUserId).toBe("caio");
    expect(settlements[0].toUserId).toBe("bruno");
  });

  it("settles each currency independently, without converting between them", () => {
    const settlements = computeSettlements([
      balance({ userId: "ana", displayName: "Ana", currency: "BRL", netBalance: "15.00" }),
      balance({ userId: "bruno", displayName: "Bruno", currency: "BRL", netBalance: "-15.00" }),
      balance({ userId: "ana", displayName: "Ana", currency: "USD", netBalance: "-8.00" }),
      balance({ userId: "bruno", displayName: "Bruno", currency: "USD", netBalance: "8.00" }),
    ]);

    expect(settlements).toHaveLength(2);
    const brl = settlements.find((s) => s.currency === "BRL");
    const usd = settlements.find((s) => s.currency === "USD");
    expect(brl).toMatchObject({ fromUserId: "bruno", toUserId: "ana", amount: "15.00" });
    expect(usd).toMatchObject({ fromUserId: "ana", toUserId: "bruno", amount: "8.00" });
  });

  it("resolves an uneven three-way split down to the cent without losing money", () => {
    // A €10.00 dinner split three ways: Ana paid, so she's owed 6.67, and
    // Bruno/Caio each owe their 3.33/3.34 shares.
    const settlements = computeSettlements([
      balance({ userId: "ana", displayName: "Ana", netBalance: "6.67" }),
      balance({ userId: "bruno", displayName: "Bruno", netBalance: "-3.33" }),
      balance({ userId: "caio", displayName: "Caio", netBalance: "-3.34" }),
    ]);

    const totalSettled = settlements.reduce(
      (sum, settlement) => sum + Number(settlement.amount),
      0,
    );
    expect(totalSettled.toFixed(2)).toBe("6.67");
    expect(settlements.every((s) => s.toUserId === "ana")).toBe(true);
  });

  it("returns no settlements when every balance is already zero", () => {
    const settlements = computeSettlements([
      balance({ userId: "ana", netBalance: "0.00" }),
      balance({ userId: "bruno", netBalance: "0.00" }),
    ]);

    expect(settlements).toEqual([]);
  });

  it("matches multiple debtors against multiple creditors until everyone is settled", () => {
    const settlements = computeSettlements([
      balance({ userId: "ana", displayName: "Ana", netBalance: "12.00" }),
      balance({ userId: "bruno", displayName: "Bruno", netBalance: "8.00" }),
      balance({ userId: "caio", displayName: "Caio", netBalance: "-15.00" }),
      balance({ userId: "duda", displayName: "Duda", netBalance: "-5.00" }),
    ]);

    const totalSettled = settlements.reduce(
      (sum, settlement) => sum + Number(settlement.amount),
      0,
    );
    expect(totalSettled.toFixed(2)).toBe("20.00");
    for (const settlement of settlements) {
      expect(["caio", "duda"]).toContain(settlement.fromUserId);
      expect(["ana", "bruno"]).toContain(settlement.toUserId);
    }
  });
});
