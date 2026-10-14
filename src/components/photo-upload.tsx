"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { ActionForm, SubmitButton } from "./forms";
import { uploadPhoto } from "@/actions/photo";

/** Inline photo picker with instant preview before upload. */
export function PhotoUpload({ userId, current, compact }: { userId: string; current: React.ReactNode; compact?: boolean }) {
  const [preview, setPreview] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  return (
    <ActionForm action={uploadPhoto} className="flex items-center gap-4">
      <input type="hidden" name="userId" value={userId} />
      <button type="button" onClick={() => input.current?.click()} className="group relative rounded-full" aria-label="Change photo">
        {preview
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={preview} alt="" className={compact ? "size-24 rounded-full object-cover" : "size-20 rounded-full object-cover"} />
          : <span aria-hidden>{current}</span>}
        <span className="absolute inset-0 grid place-items-center rounded-full bg-black/40 text-white opacity-0 transition group-hover:opacity-100"><Camera className="size-5" /></span>
      </button>
      <input
        ref={input} type="file" name="photo" aria-label="Photo" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; setPreview(f ? URL.createObjectURL(f) : null); }}
      />
      {compact ? (
        preview && <SubmitButton size="sm">Save photo</SubmitButton>
      ) : (
        <div className="text-sm">
          <p className="font-medium">Profile photo</p>
          <p className="text-xs text-muted">JPEG, PNG or WebP, up to 1 MB. Click the picture to change it.</p>
          {preview && <SubmitButton size="sm" className="mt-2">Save photo</SubmitButton>}
        </div>
      )}
    </ActionForm>
  );
}
