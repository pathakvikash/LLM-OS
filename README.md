# LLM-OS

A macOS-inspired desktop environment that runs entirely in the browser, built with Next.js. Everything — the windowing, the filesystem, the shell — is simulated client-side; nothing here touches your real machine.

## Features

- **Desktop shell** — wallpaper, translucent menu bar, and a Dock with running-app indicators, all styled with a glassmorphism design system.
- **Window manager** — draggable and resizable windows with focus/z-order, minimize (genie-style), maximize/restore, and layout persisted across reloads.
- **Spotlight** (`⌘K` / `Ctrl+K`) — fuzzy search across installed apps and virtual files, with keyboard navigation and instant launch/reveal.
- **Finder** — browses a virtual filesystem (persisted in IndexedDB): navigate, create/rename/delete files and folders, drag-and-drop upload from your real desktop, and a built-in text preview/editor.
- **Terminal** — a simulated shell (agents' shell commands are echoed into every open Terminal window, attributed to the agent that ran them) (`ls`, `cd`, `pwd`, `cat`, `mkdir`, `touch`, `echo`, `rm`, `mv`, `whoami`, `date`, `clear`, `help`) operating on the same virtual filesystem as Finder — changes in one show up live in the other.
- **Agents** — an agent control plane whose runs actually drive this OS. **Chat** with the orchestrator and it routes each request to the agent whose skills fit, splitting a multi-part message across agents and delegating each half; runs stream into the conversation as live cards, and a finished run's file or app carries into the next turn so a follow-up can say "it". Conversations are kept as named sessions you can switch between, rename, and delete; context carries within a session and never across. Plain conversation is answered directly from live state — greetings, "help", "what apps do you have", "what access do you have", "how many runs" — so chatting never dead-ends in an error. Define agents (model, system prompt, granted skills, pace), trigger them on demand or on a schedule, and watch each run perform real work: reading and writing the virtual filesystem, opening/focusing/closing app windows, changing appearance, accent, wallpaper and Dock size, and running Terminal commands. Agents plan one of two ways. **Skills** are recipes that turn a plain-language task into a sequence of actions — chosen by trigger-word match (a trigger standing where the verb goes counts for more, so "open the terminal" is a request to open something), with `{{variables}}` interpolated from the task and from earlier steps' results; build your own in the step editor. A task that asks for two things ("open Terminal and run ls") plans both skills in order, app names survive typos, and any clause no granted skill can take is reported rather than dropped. The **Operator** plans the other way: it reads the instruction itself — verb, object, arguments — and composes the actions, so "create a folder named vikash" works with no recipe written for it, follow-ups like "in it add 2 files" resolve against what the last run touched, and the orchestrator hands it anything the skills don't cover. **Connectors** are the permission layer — five subsystems (files, apps and windows, settings, shell, and the agent fleet itself, which lets the chat create agents and rewrite prompts), and every action declares the connector and the access (read or write) it needs, and a disconnected or read-only connector stops the step and says so. A fleet-wide **system prompt** composes with each agent's own brief, its granted skills, and the access its connectors allow, and every run keeps the copy it was planned against. Runs are tracked live: queue, per-step progress, activity log, produced output, cancel and re-run. No model is called by default, so token and cost figures are estimates; the actions are not.
- **Bring your own model** — Settings → AI takes an OpenRouter, NVIDIA NIM, or Anthropic API key — one per provider, saved explicitly, sent only to that provider. OpenRouter lists its free models by default. For a key the browser never sees, set `OPENROUTER_API_KEY`, `NVIDIA_API_KEY`, or `ANTHROPIC_API_KEY` in the server environment and calls are proxied through `/api/llm` instead. With a key, agents plan by calling the same actions as tools: the model chooses each step, results feed back, and it can hand work to other agents through `fleet.delegate`. Connector permissions still bind it, writes can require your approval, token counts and cost become real, and a spend cap stops it. With no key — or if the call fails — planning falls back to the built-in rules and the run says so.
- **Settings** — Appearance (light/dark/auto + accent color), Wallpaper, Dock size, Sound, AI (bring-your-own API key), and About panes, all applied instantly across the whole OS.

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
- **Agent runtime** (`lib/agents/`) — `actions.ts` is the capability surface (VFS, window manager, theme/Dock stores, Terminal command registry), `connectors.ts` the permission model those actions are gated by, `skills.ts` the task→plan matcher, `orchestrator.ts` the agent router behind the chat session, `interpreter.ts` the instruction→actions parser the generalist plans with, `prompt.ts` the composed fleet brief, `engine.ts` the pure run-state transitions, `executor.ts` the async walk that performs each step and re-checks cancellation between them, and `runtime.ts` an OS-level scheduler the desktop starts once — so queued and scheduled runs keep progressing with the Agents window closed.
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
  apps/                Finder, Terminal, Agents, Settings
  ui/                   Shared glass-styled primitives
lib/
  apps/                App registry
  fs/                  Virtual filesystem (Dexie schema, seed data, pure VFS functions)
  agents/              Agent capabilities: actions, connectors, skills, interpreter, orchestrator, conversation, prompt, engine, executor, modelRunner, scheduler
  llm/                 Optional model access: provider interface, OpenAI-compatible client (OpenRouter, NVIDIA), Anthropic, tool schema
  commands/            Menu-bar → app command bus
  theme/               Wallpaper presets
stores/                Zustand stores (windows, theme, dock, spotlight, finder target, agents, llm)
```

## License

MIT
