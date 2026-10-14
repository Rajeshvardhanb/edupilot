"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { submitFeedback } from "@/actions/exams";
import { cn } from "@/lib/utils";

export function FeedbackForm({ offeringId, questions }: { offeringId: string; questions: string[] }) {
  const [ratings, setRatings] = useState<number[]>(() => questions.map(() => 0));
  return (
    <ActionForm action={submitFeedback} className="space-y-3" toastSuccess>
      <input type="hidden" name="offeringId" value={offeringId} />
      {questions.map((q, i) => (
        <div key={q} className="flex items-center justify-between gap-3">
          <span className="text-sm">{q}</span>
          <input type="hidden" name={`q${i}`} value={ratings[i]} />
          <span className="flex" role="radiogroup" aria-label={q}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={ratings[i] === n} aria-label={`${n} of 5`} onClick={() => setRatings((r) => r.map((v, j) => (j === i ? n : v)))} className="p-0.5">
                <Star className={cn("size-5 transition", n <= ratings[i] ? "fill-amber-400 text-amber-400" : "text-line")} />
              </button>
            ))}
          </span>
        </div>
      ))}
      <textarea name="comment" rows={2} placeholder="Anything else? (optional)" className="input" />
      <SubmitButton size="sm">Submit feedback</SubmitButton>
    </ActionForm>
  );
}
