import { Loader2 } from "lucide-react";

export function LiveRoomLoading() {
  return (
    <div className="min-h-[100dvh] bg-black light:bg-surface-page flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-accent" />
    </div>
  );
}
