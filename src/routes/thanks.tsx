import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { CampScene, Lanterns } from "@/components/camp/CampScene";

export const Route = createFileRoute("/thanks")({
  head: () => ({
    meta: [
      { title: "Thanks for playing! · Camp Who's Most Likely To" },
      { name: "description", content: "That's a wrap on tonight's campfire game. All photos have been deleted." },
      { property: "og:title", content: "Thanks for playing! · Camp Who's Most Likely To" },
      { property: "og:description", content: "That's a wrap on tonight's campfire game." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Thanks,
});

function Thanks() {
  return (
    <CampScene fire>
      <Lanterns />
      <main className="relative flex flex-1 flex-col items-center justify-center gap-8 text-center">
        <p className="animate-pop-in text-8xl">🏕️</p>
        <h1 className="animate-rise-in font-display text-5xl leading-tight text-cream text-glow sm:text-6xl">
          Thanks for playing!
        </h1>
        <p className="animate-rise-in max-w-xs text-lg text-muted-foreground" style={{ "--delay": "0.2s" } as React.CSSProperties}>
          The fire's out, the stories stay. All photos from this game have been deleted.
        </p>
        <Button asChild variant="camp" size="jumbo" className="w-full max-w-sm">
          <Link to="/">Play again</Link>
        </Button>
      </main>
    </CampScene>
  );
}
