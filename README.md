# LLM-OS

A macOS-inspired desktop environment that runs entirely in the browser, built with Next.js. Everything — the windowing, the filesystem, the shell — is simulated client-side; nothing here touches your real machine.

## Features

- **Desktop shell** — wallpaper, translucent menu bar, and a Dock with running-app indicators, all styled with a glassmorphism design system.
- **Window manager** — draggable and resizable windows with focus/z-order, minimize (genie-style), maximize/restore, and layout persisted across reloads.
- **Spotlight** (`⌘K` / `Ctrl+K`) — fuzzy search across installed apps and virtual files, with keyboard navigation and instant launch/reveal.
- **Finder** — browses a virtual filesystem (persisted in IndexedDB): navigate, create/rename/delete files and folders, drag-and-drop upload from your real desktop, and a built-in text preview/editor.
- **Terminal** — a simulated shell (`ls`, `cd`, `pwd`, `cat`, `mkdir`, `touch`, `echo`, `rm`, `mv`, `whoami`, `date`, `clear`, `help`) operating on the same virtual filesystem as Finder — changes in one show up live in the other.
- **Settings** — Appearance (light/dark/auto + accent color), Wallpaper, Dock size, Sound, and About panes, all applied instantly across the whole OS.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Architecture

- **Next.js (App Router) + TypeScript** — the whole OS renders client-side inside a single route.
- **Tailwind CSS + CSS custom properties** — the glass design tokens (`app/globals.css`) drive both Tailwind utilities and runtime re-theming from Settings.
- **Zustand** — window manager, theme, dock, and spotlight state (`stores/`).
- **Framer Motion** — window open/close/minimize/maximize and Spotlight transitions.
- **Dexie (IndexedDB)** — the virtual filesystem (`lib/fs/`), shared by Finder, Terminal, and Spotlight through one small set of pure functions (`lib/fs/vfs.ts`).
- **App registry** (`lib/apps/registry.ts`) — the single source of truth for installed apps, consumed by the Dock, Spotlight, menu bar, and the window manager. Adding a new app is one registry entry.

### Project structure

```
app/                   Next.js App Router entry (layout, page, global styles)
components/
  desktop/             Wallpaper, global hotkeys, theme effect, Desktop shell
  window-manager/      Window chrome, drag/resize hooks, window layer
  menu-bar/            Menu bar, Apple menu, per-app dropdown menus
  dock/                Dock and dock icons
  spotlight/           Spotlight search overlay
  apps/                Finder, Terminal, Settings (+ shared Hello test app)
  ui/                   Shared glass-styled primitives
lib/
  apps/                App registry
  fs/                  Virtual filesystem (Dexie schema, seed data, pure VFS functions)
  commands/            Menu-bar → app command bus
  theme/               Wallpaper presets
stores/                Zustand stores (windows, theme, dock, spotlight, finder target)
```

## License

MIT
