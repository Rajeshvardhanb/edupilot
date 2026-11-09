"use client";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Camera } from "lucide-react";
import { uploadPhoto, removePhoto } from "@/actions/photo";
import { ActionButton, ActionForm, SubmitButton } from "./forms";
import { buttonClass } from "./ui";
const subscribeReady = () => () => {};
const clientReady = () => true, serverReady = () => false;
export function PhotoUpload({ userId, current, hasPhoto }: { userId: string; current: ReactNode; hasPhoto: boolean }) {
  const ready = useSyncExternalStore(subscribeReady, clientReady, serverReady);
  const [preview, setPreview] = useState<string | null>(null), input = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  return <div className="space-y-3">
    <ActionForm action={uploadPhoto} className="space-y-3" onResult={s => { if (s.ok) { setPreview(null); if (input.current) input.current.value = ""; } }}>
      <input type="hidden" name="userId" value={userId} />
      <div className="flex flex-wrap items-center gap-4">
        {preview
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={preview} alt="Selected photo preview" className="size-20 rounded-2xl object-cover" /> : current}
        <div className="min-w-0"><p className="font-medium">Profile photo</p><p className="text-xs text-muted">JPEG, PNG or WebP · up to 1 MB</p>
          <button type="button" disabled={!ready} className={buttonClass("secondary", "sm") + " mt-2"} onClick={() => input.current?.click()}><Camera className="size-4" />{hasPhoto ? "Change photo" : "Choose photo"}</button>
        </div>
      </div>
      <input ref={input} type="file" name="photo" aria-label="Profile photo file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const file = e.target.files?.[0]; setPreview(file ? URL.createObjectURL(file) : null); }} />
      {preview && <SubmitButton size="sm">Save photo</SubmitButton>}
    </ActionForm>
    {hasPhoto && <ActionButton action={removePhoto} fields={{ userId }} variant="danger" confirm="Remove this profile photo? Initials will be displayed instead. Other profile details stay unchanged.">Remove photo</ActionButton>}
  </div>;
}
