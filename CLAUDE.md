# SynLauncher

Electron-based launcher for the Synastria WoW private server (3.3.5a) with addon management.

## Tech Stack

- **Electron** (v25.9.8) with `nodeIntegration: true`, `contextIsolation: false`
- **JavaScript** (Node.js) - no TypeScript, no bundler, no framework
- **Dependencies**: axios, adm-zip, extract-zip, webtorrent, cheerio, js-yaml, electron-builder

## Project Structure

```
main.js          - Electron main process, IPC handlers (373 lines)
renderer.js      - UI logic, all DOM built programmatically (765 lines)
functions.js     - Core utilities: config, torrent, addon download/update/extract (450 lines)
constants.js     - Config paths, URLs, magnet link
patch_scraper.js - Scrapes synastria.org for WoWExt patch URL
index.html       - Minimal initial markup
addons_list.json - Curated addon catalog (23 addons, fetched remotely at runtime)
```

## Architecture

- **IPC-based**: renderer calls main process via `ipcRenderer.invoke()` / `ipcMain.handle()`
- **Config**: stored at `%APPDATA%/Synastria/config.json` with fields: `installed`, `clientDir`, `patchVersion`, `addons[]`
- **Addon list**: fetched from GitHub raw URL at runtime, local `addons_list.json` is the source of truth pushed to GitHub
- **All UI** is built dynamically in `renderer.js` (no components, no templates)

## Key IPC Handlers (main.js)

| Handler | Purpose |
|---|---|
| `get-addons-list` | Fetch curated list, merge with install state |
| `install-addon` | Download + extract + save config |
| `uninstall-addon` | Remove files + update config |
| `update-addon` | Force re-download single addon |
| `auto-update-addons` | Check all installed addons for hash changes |
| `download-and-install-patch` | Scrape + download + extract WoWExt patch |
| `launch-wowext` | Spawn `wowext.exe` detached |
| `check-for-launcher-update` | Compare GitHub releases vs app version |

## Addon System

### How addons work
1. Each addon in `addons_list.json` has: `name`, `Author`, `folder`, `repo` (GitHub URL), `description`
2. Install: fetch latest commit SHA, download repo ZIP, scan for `.toc` files, extract matching folders to `Interface/AddOns/`
3. Update check: compare stored commit hash vs GitHub API latest commit
4. Auto-update runs on every app launch for all installed addons
5. Config tracks: `{ name, hash (commit SHA), lastUpdated (ISO timestamp) }`

### Branch detection (functions.js:239-274)
- Hardcoded to `master` for: ArkInventory, AtlasLoot_Mythic, ElvUI_Attune
- All others: fetches `default_branch` from GitHub API, falls back to `main` then `master`

### Special uninstall logic
- AtlasLoot: removes ALL folders starting with "AtlasLoot" (handles sub-modules)
- ArkInventory: also uses wildcard removal

## Known Issues

- **No GitHub API rate limit handling**: `fetchLatestCommitHash` logs 403/429 but doesn't retry or backoff. With 23 addons, unauthenticated API calls (60/hour limit) can be exhausted quickly.

## Build & Run

```bash
npm start          # Run in development
npm run dist       # Build with electron-builder
npm run publish    # Build and publish to GitHub releases
```

## Commands Reference

- `npm start` - launch dev mode
- `npm run dist` - package for distribution
- Published via GitHub releases (electron-builder, provider: github, owner: binnesman)
