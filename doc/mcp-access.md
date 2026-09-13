# MCP access for AI agents

Reading Journal provides a remote MCP endpoint so Codex and Claude Code can read and update your library using an API key you create in the app.

## Create a dedicated key

1. In Reading Journal, open **Settings → API keys**.
2. Create a key named for the agent, such as `Codex on my laptop`.
3. Copy it when it is shown. The full value cannot be displayed again.
4. Put it in an environment variable on your computer:

   ```sh
   export READING_JOURNAL_API_KEY='rjk_live_...'
   ```

Use one key per agent. If a device is lost or an integration is no longer needed, revoke only that key from **Settings → API keys**.

## Connect an agent

The production MCP URL is:

```text
https://<your-reading-journal-domain>/api/mcp
```

Configure the client to use that URL with a bearer token from `READING_JOURNAL_API_KEY`. Do not put the key in a URL, a repository file, or browser configuration.

For Codex, run this once after setting the environment variable:

```sh
codex mcp add reading-journal \
  --url https://<your-reading-journal-domain>/api/mcp \
  --bearer-token-env-var READING_JOURNAL_API_KEY
```

For Claude Code, create a personal `.mcp.json` configuration (do not commit it) with environment-variable expansion:

```json
{
  "mcpServers": {
    "reading-journal": {
      "type": "http",
      "url": "https://<your-reading-journal-domain>/api/mcp",
      "headers": {
        "Authorization": "Bearer ${READING_JOURNAL_API_KEY}"
      }
    }
  }
}
```

Keep the key in your shell or secret manager rather than committing it.

The server offers these tools: `list_books`, `search_books`, `get_book_progress`, `log_reading_progress`, `add_book_journal_entry`, and `update_book`.

Examples to try:

- “I just finished reading up to page 214 of the Connie Willis book I’m currently reading.”
- “I just read this really nice quote on page 83: …”
- “I just finished the book and really liked it. I would give it five stars.”

The connected agent resolves the book first and asks when multiple books match. It preserves quotes exactly and will only mark a book finished when you say it was finished.

## Local development

Vite’s `npm run dev` command does not run Vercel API functions. To test MCP locally, use:

```sh
npx vercel dev
```

Set this server-only value in `.env.local`:

```text
READING_JOURNAL_API_ORIGIN=http://localhost:3000
```

Point your local MCP client at `http://localhost:3000/api/mcp`. Use a separate, revocable API key for local testing.

## Deploying

In Vercel, set `READING_JOURNAL_API_ORIGIN` to the production HTTPS URL of this app, for example `https://reading-journal.example.com`. The MCP route refuses an unset, non-HTTPS, or non-localhost origin so an incoming `Host` header can never redirect an API key to another server.
