import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function EndGameButton({ onConfirm }: { onConfirm: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="night" size="sm" className="h-10 rounded-full px-4 text-base">
          End Game
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="panel border-cream/20 bg-popover">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-2xl text-cream">Put out the campfire?</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            This ends the game for everyone right now and deletes all photos.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-12 rounded-2xl">Keep playing</AlertDialogCancel>
          <AlertDialogAction
            className="min-h-12 rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={busy}
            onClick={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Ending…" : "End Game"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
