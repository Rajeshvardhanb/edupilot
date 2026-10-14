"use client";

import { useState, useTransition } from "react";
import { CreditCard, Landmark, Smartphone } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { razorpayConfirm, sandboxPay } from "@/actions/pay";
import { buttonClass } from "@/components/ui";
import { cn } from "@/lib/utils";

const METHODS = [{ v: "UPI", label: "UPI", icon: Smartphone }, { v: "CARD", label: "Card", icon: CreditCard }, { v: "NETBANKING", label: "Net banking", icon: Landmark }];

export function SandboxCheckout({ orderId, failed }: { orderId: string; failed: boolean }) {
  const [method, setMethod] = useState("UPI");
  return (
    <ActionForm action={sandboxPay} className="space-y-4">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="method" value={method} />
      {failed && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">The last attempt failed. Nothing was charged.</p>}
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Payment method">
        {METHODS.map(({ v, label, icon: Icon }) => (
          <button key={v} type="button" role="radio" aria-checked={method === v} onClick={() => setMethod(v)} className={cn("flex flex-col items-center gap-1 rounded-xl border p-3 text-xs", method === v ? "border-brand bg-brand-soft text-brand" : "border-line text-muted")}>
            <Icon className="size-5" />{label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="submit" name="outcome" value="fail" className={buttonClass("secondary")}>Simulate failure</button>
        <SubmitButton>Simulate success</SubmitButton>
      </div>
    </ActionForm>
  );
}

type RazorpayResult = { razorpay_payment_id: string; razorpay_signature: string };
declare global { interface Window { Razorpay?: new (opts: Record<string, unknown>) => { open: () => void } } }

export function RazorpayCheckout(p: { orderId: string; providerOrderId: string; keyId: string; amountPaise: number; college: string; description: string; name: string; email: string; phone: string; testMode: boolean }) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  // Razorpay calls this in the browser; the server re-checks the signature before recording anything.
  function confirm(r: RazorpayResult) {
    const fd = new FormData();
    fd.set("orderId", p.orderId);
    fd.set("razorpay_payment_id", r.razorpay_payment_id);
    fd.set("razorpay_signature", r.razorpay_signature);
    startTransition(async () => {
      const result = await razorpayConfirm({}, fd);
      if (result?.error) setError(result.error);
    });
  }
  function open() {
    setError("");
    const start = () => {
      new window.Razorpay!({
        key: p.keyId, amount: p.amountPaise, currency: "INR", name: p.college, description: p.description, order_id: p.providerOrderId,
        prefill: { name: p.name, email: p.email, contact: p.phone }, handler: confirm,
      }).open();
    };
    if (window.Razorpay) return start();
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = start;
    s.onerror = () => setError("Could not load the payment window. Check your internet connection.");
    document.body.appendChild(s);
  }
  return (
    <>
      {p.testMode && <p className="mb-3 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">Razorpay test mode: use Razorpay&apos;s test cards or UPI IDs. No real money moves.</p>}
      <button type="button" onClick={open} disabled={pending} className={cn(buttonClass("primary"), "w-full py-3")}>{pending ? "Confirming payment…" : "Pay securely with Razorpay"}</button>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </>
  );
}
