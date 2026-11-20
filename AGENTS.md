<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- No user accounts: hosts prove ownership with a secret host token (stored in `room_secrets`, never readable by the browser); every state change goes through server functions in `src/lib/game.functions.ts` that call service-role-only SQL functions, so game rules run atomically on the database clock.
- Browsers only read `rooms` and `players` (public SELECT + Realtime); `submissions` and photos are server-only so reveals stay anonymous. Photos live in the private `photos` bucket at `<roomId>/r<round>-<playerId>-<id>.jpg` (flat, so one listing finds them all for cleanup).
- Countdown and reveal timing derive from server timestamps (`round_started_at`, `reveal_started_at`) plus a measured clock offset, so all phones stay in sync; pure timing/grouping helpers live in `src/lib/game-utils.ts` with tests in `src/test/game-rules.test.ts`.
- Prompts and avatars are edited in `src/lib/prompts.ts` only; the server reads the round count from there too.
- Room data is purged when a game ends, and rooms older than 24 hours are purged whenever a new room is created (no scheduled job).
