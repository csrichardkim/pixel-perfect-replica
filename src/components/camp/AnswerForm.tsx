import { useEffect, useRef, useState } from "react";
import { Camera, ImageIcon, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMySubmission, getUploadTarget, submitAnswer } from "@/lib/game.functions";
import { compressImage, uploadToSignedUrl } from "@/lib/photo";

type Stage = "loading" | "editing" | "sending" | "locked";

const ERRORS: Record<string, string> = {
  round_closed: "Time's up for this round! Hang tight for the reveal.",
  not_in_room: "We lost track of you — try rejoining the room.",
  next_round: "You joined mid-round. You're in starting next round!",
};

export function AnswerForm({ code, playerId, round }: { code: string; playerId: string; round: number }) {
  const [stage, setStage] = useState<Stage>("loading");
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    getMySubmission({ data: { code, playerId, round } })
      .then((r) => {
        if (!alive) return;
        if (r.chosenName) {
          setName(r.chosenName);
          setStage("locked");
        } else setStage("editing");
      })
      .catch(() => alive && setStage("editing"));
    return () => {
      alive = false;
    };
  }, [code, playerId, round]);

  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo.url);
  }, [photo]);

  async function onFile(file: File | undefined, fromCamera: boolean) {
    setError(null);
    if (!file) {
      if (fromCamera)
        setHint("Camera didn't open? Your browser may have blocked it — tap “Choose from gallery” instead, or allow camera access in your settings.");
      return;
    }
    setHint(null);
    try {
      setStatus("Shrinking photo…");
      const blob = await compressImage(file);
      setPhoto({ blob, url: URL.createObjectURL(blob) });
    } catch {
      setError("Couldn't read that photo. Try taking another one or pick a different picture.");
    } finally {
      setStatus("");
    }
  }

  async function submit() {
    if (!photo || !name.trim()) return;
    setStage("sending");
    setError(null);
    setProgress(0);
    let lastErr = "Upload failed. Check your signal and try again.";
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        setStatus(attempt === 1 ? "Uploading…" : `Weak signal — retrying (${attempt}/3)…`);
        const target = await getUploadTarget({ data: { code, playerId, round } });
        if (!target.ok) {
          lastErr = ERRORS[target.error] ?? lastErr;
          if (target.error in ERRORS) break;
          continue;
        }
        await uploadToSignedUrl(target.path, target.token, photo.blob, setProgress);
        setStatus("Locking it in…");
        const res = await submitAnswer({ data: { code, playerId, round, name: name.trim(), path: target.path } });
        if (!res.ok) {
          lastErr = ERRORS[res.error] ?? lastErr;
          if (res.error in ERRORS) break;
          continue;
        }
        setStage("locked");
        setStatus("");
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 800 * attempt));
      }
    }
    setError(lastErr);
    setStatus("");
    setStage("editing");
  }

  if (stage === "loading") {
    return <p className="animate-pulse text-center font-display text-xl text-muted-foreground">Loading…</p>;
  }

  if (stage === "locked") {
    return (
      <div className="panel animate-pop-in flex flex-col items-center gap-3 p-6 text-center">
        <p className="text-6xl">🔥</p>
        <p className="font-display text-3xl text-flame">Locked in!</p>
        <p className="text-lg">
          You picked <span className="font-hand text-2xl text-cream">{name}</span>
        </p>
        <p className="text-muted-foreground">Waiting for others…</p>
        <Button variant="night" size="xl" className="mt-2 w-full" onClick={() => setStage("editing")}>
          Change my answer
        </Button>
      </div>
    );
  }

  const sending = stage === "sending";
  return (
    <div className="panel flex flex-col gap-4 p-4 sm:p-6">
      <label className="flex flex-col gap-2">
        <span className="font-display text-xl">1. Who's your pick?</span>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 40))}
          placeholder="Type their name"
          autoComplete="off"
          enterKeyHint="done"
          disabled={sending}
          className="h-14 rounded-2xl border-cream/30 bg-night-deep/60 px-4 text-xl text-cream placeholder:text-muted-foreground/70"
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="font-display text-xl">2. Snap their photo</span>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            void onFile(e.target.files?.[0], true);
            e.target.value = "";
          }}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void onFile(e.target.files?.[0], false);
            e.target.value = "";
          }}
        />
        {photo ? (
          <div className="flex flex-col items-center gap-3">
            <div className="polaroid w-48 rotate-[-3deg]">
              <img src={photo.url} alt="Your photo preview" className="aspect-[4/5] w-full rounded-sm object-cover" />
              <p className="truncate py-1 text-center font-hand text-xl">{name || "…"}</p>
            </div>
            <div className="grid w-full grid-cols-2 gap-2">
              <Button variant="night" size="xl" disabled={sending} onClick={() => cameraRef.current?.click()}>
                <RotateCcw /> Retake
              </Button>
              <Button
                variant="night"
                size="xl"
                disabled={sending}
                aria-label="Choose from gallery"
                onClick={() => galleryRef.current?.click()}
              >
                <ImageIcon /> Gallery
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Button variant="lake" size="xl" className="w-full" onClick={() => cameraRef.current?.click()}>
              <Camera /> Take a photo
            </Button>
            <Button variant="night" size="xl" className="w-full" onClick={() => galleryRef.current?.click()}>
              <ImageIcon /> Choose from gallery
            </Button>
            <p className="text-sm text-muted-foreground">
              Tip: want a selfie? Tap the flip-camera button once your camera opens.
            </p>
          </>
        )}
        {hint && <p className="rounded-xl bg-lake/15 p-3 text-sm text-cream">{hint}</p>}
      </div>

      {status && <p className="text-center font-display text-lg text-flame">{status}</p>}
      {sending && (
        <div className="h-3 w-full overflow-hidden rounded-full bg-night-deep">
          <div className="h-full bg-fire transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
      {error && <p className="rounded-xl bg-destructive/20 p-3 text-center text-cream">{error}</p>}

      <Button
        variant="camp"
        size="jumbo"
        className="w-full"
        disabled={sending || !photo || !name.trim()}
        onClick={() => void submit()}
      >
        {sending ? `Sending ${Math.round(progress * 100)}%` : "Submit 🔥"}
      </Button>
    </div>
  );
}
