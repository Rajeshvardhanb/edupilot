import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoiceStatus } from "@/lib/fees";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const pay = (...amounts: number[]) => amounts.map((amount) => ({ amount }));

describe("invoiceStatus", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(d("2026-10-10")); });
  afterEach(() => vi.useRealTimers());

  it("is DUE before the due date with nothing paid", () => {
    expect(invoiceStatus({ amount: 1000, concession: 0, dueDate: d("2026-12-01"), payments: [] })).toMatchObject({ status: "DUE", payable: 1000, paid: 0, balance: 1000 });
  });

  it("is OVERDUE after the due date", () => {
    expect(invoiceStatus({ amount: 1000, concession: 0, dueDate: d("2026-09-30"), payments: [] }).status).toBe("OVERDUE");
  });

  it("is PARTIAL when part-paid before the due date, and PAID once the balance is zero", () => {
    expect(invoiceStatus({ amount: 1000, concession: 0, dueDate: d("2026-12-01"), payments: pay(400) })).toMatchObject({ status: "PARTIAL", balance: 600 });
    expect(invoiceStatus({ amount: 1000, concession: 0, dueDate: d("2026-09-30"), payments: pay(400, 600) })).toMatchObject({ status: "PAID", balance: 0 });
  });

  it("subtracts concessions from what is payable", () => {
    expect(invoiceStatus({ amount: 1000, concession: 250, dueDate: d("2026-09-30"), payments: pay(750) })).toMatchObject({ payable: 750, status: "PAID" });
  });

  it("adds a late fine unless it has been waived", () => {
    const base = { amount: 1000, concession: 0, dueDate: d("2026-09-30"), payments: pay(1000), fine: 200 };
    expect(invoiceStatus(base)).toMatchObject({ payable: 1200, balance: 200, fine: 200, status: "OVERDUE" });
    expect(invoiceStatus({ ...base, fineWaived: true })).toMatchObject({ payable: 1000, balance: 0, fine: 0, status: "PAID" });
  });

  describe("with an instalment plan", () => {
    const plan = [{ dueDate: d("2026-08-31"), amount: 500 }, { dueDate: d("2026-12-15"), amount: 500 }];
    const inv = (...paid: number[]) => ({ amount: 1000, concession: 0, dueDate: d("2026-12-15"), payments: pay(...paid), instalments: plan });

    it("is not overdue when the instalments that have fallen due are paid", () => {
      const s = invoiceStatus(inv(500));
      expect(s).toMatchObject({ status: "PARTIAL", arrears: 0, balance: 500 });
      expect(s.nextDue).toEqual(d("2026-12-15"));
    });

    it("is overdue by exactly the unpaid part of the instalments that have fallen due", () => {
      expect(invoiceStatus(inv(200))).toMatchObject({ status: "OVERDUE", arrears: 300 });
      expect(invoiceStatus(inv()).nextDue).toEqual(d("2026-08-31"));
    });
  });
});
