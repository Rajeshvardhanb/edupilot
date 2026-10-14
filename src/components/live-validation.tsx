"use client";

import { createContext, use } from "react";

/** Messages for fields checked as the user leaves them (before the form is submitted), keyed by field name. */
export const LiveContext = createContext<Record<string, string>>({});

/** Shows the as-you-type message for one field. Rendered by <Field>; silent outside an <ActionForm>. */
export function LiveError({ name }: { name?: string }) {
  const msg = use(LiveContext)[name ?? ""];
  if (!msg) return null;
  return <p role="alert" className="mt-1 text-xs text-danger">{msg}</p>;
}

/** A plain-language message for a field the browser considers invalid. */
export function validityMessage(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  const v = el.validity;
  if (v.valid) return "";
  if (v.valueMissing) return el instanceof HTMLSelectElement ? "Choose one." : "This is required.";
  if (v.typeMismatch) return el.type === "email" ? "Enter a full email address, like name@college.edu." : el.type === "url" ? "Enter a full web address, starting with https://" : "That doesn't look right.";
  if (v.rangeUnderflow) return `Must be ${(el as HTMLInputElement).min} or more.`;
  if (v.rangeOverflow) return `Must be ${(el as HTMLInputElement).max} or less.`;
  if (v.tooShort) return `Use at least ${(el as HTMLInputElement).minLength} characters.`;
  if (v.patternMismatch) return el.title || "That isn't in the expected format.";
  if (v.badInput || v.stepMismatch) return "Enter a number.";
  return el.validationMessage;
}
