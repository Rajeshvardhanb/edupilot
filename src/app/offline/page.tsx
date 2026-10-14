import { WifiOff } from "lucide-react";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <div className="grid min-h-screen place-items-center p-6 text-center">
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/mark-192.png" alt="" width={72} height={72} className="mx-auto" />
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-warning"><WifiOff className="size-3.5" /> No connection</p>
        <h1 className="mt-4 text-xl font-semibold">You&apos;re offline</h1>
        <p className="mt-2 max-w-sm text-sm text-muted">Pages you opened earlier still work. Attendance you mark now is kept on this device and uploads automatically when the connection returns.</p>
      </div>
    </div>
  );
}
