<pre align="center">
                     ▄   ▄                        ▄
▀▀▀█ █▀▀▀ ▀▀▀█ █▀▀▀ ▀█▀▀ █▀▀█ ▀▀▀█   █▀▀▀ █▀▀█ █▀▀█ █▀▀█
█▀▀█ █ ▀█ █▀▀█ █     █   █  █ █▀▀█   █    █  █ █  █ █▀▀▀
▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀     ▀▀▀ ▀  ▀ ▀▀▀▀   ▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀
</pre>

<p align="center"><b>AgarthaOpen-Code</b> — the open-source, model-agnostic AI coding agent for your terminal and desktop,<br/>guarded by the <b>Gilles-Dini Monitor</b>.</p>

<p align="center">Created by <a href="https://x.com/RealJasonGilles">Jason Gilles</a></p>

---

## What it is

AgarthaOpen-Code is a command-line-first AI coding assistant. You chat with an agent in a polished terminal UI, and it can read your project, write and edit code, and run commands for you — with a cross-platform desktop app (Windows, macOS, Linux) that offers the same experience.

- **Model-agnostic.** Bring your own key for OpenAI, Anthropic, Google and many other providers, or point it at a local model (Ollama, LM Studio, llama.cpp or any OpenAI-compatible server).
- **Two built-in modes**, switchable with <kbd>Shift</kbd>+<kbd>Tab</kbd>:
  - **Build** — the full-power development agent. Edits files freely and runs commands.
  - **Plan** — read-only analysis. It can't modify your files, and it asks for permission before running any command.
- **Gilles-Dini Monitor** — an external, tamper-resistant safety monitor that watches every action the agent tries to take (see below).
- **Terminal and desktop.** The TUI and the Electron desktop app share the same core and server.
- **Written in TypeScript**, running on Bun.

## The Gilles-Dini Monitor

Most coding agents decide each permission in isolation: is _this_ command allowed? The Gilles-Dini Monitor also looks at what the agent has been doing across the session.

It sits in the permission layer, outside the model's reach — no tool can read, reset or reconfigure it. Every request the agent makes is scored, and each session carries a cumulative **containment-risk budget**:

| Situation | What the monitor does |
| --- | --- |
| Reads, searches, listing files | Never restricted — the agent can always look and explain |
| A single high-risk action (e.g. `curl … \| sudo bash`) | Requires your approval, even if your config allowed it |
| A suspicious capability chain (e.g. reading `.env` or `~/.ssh`, then sending data off the machine) | Requires your approval before the chain completes |
| Session risk past 60% of the budget | Every risky action requires your approval |
| Budget exhausted | Risky actions are denied |
| Scheduled or unattended runs | Anything the monitor would ask about is denied, since nobody is there to approve it |

The monitor can only make a decision **stricter**; it never overrides a deny you configured. Usage decays as the session goes on, so a long, ordinary session of edits and test runs stays well under the thresholds while a burst of dangerous actions crosses them quickly.

It watches for destructive operations (`rm -rf`, `git push --force`, `git reset --hard`), remote code execution (piping downloads into a shell), data egress (`curl -d`, `scp`, `nc`), credential access (`.env`, SSH keys, cloud credentials), privilege escalation (`sudo`, `chmod 777`), and persistence (cron jobs, shell startup files, git hooks, CI workflows).

Configuration:

```bash
AGARTHA_GILLES_DINI_BUDGET=50 agartha   # larger budget (default 30)
AGARTHA_GILLES_DINI=off agartha         # disable the monitor
```

Source: [`packages/core/src/gilles-dini.ts`](packages/core/src/gilles-dini.ts), tests in [`packages/core/test/gilles-dini.test.ts`](packages/core/test/gilles-dini.test.ts).

## Getting started (from source)

Requires [Bun](https://bun.sh) 1.4+.

```bash
git clone https://github.com/TveJason/AgarthaOpen-Code
cd AgarthaOpen-Code
bun install
bun run agartha            # launch the terminal UI in the current directory
bun run dev:desktop        # launch the desktop app in dev mode
```

Inside the TUI, run `/connect` to add an API key for OpenAI, Anthropic, Google or another provider, or to configure a local model, then `/models` to pick one.

### Local models

Any OpenAI-compatible server works. Example for Ollama in `opencode.json` at your project root:

```json
{
  "provider": {
    "ollama": {
      "npm": "@ai-sdk/openai-compatible",
      "options": { "baseURL": "http://localhost:11434/v1" },
      "models": { "qwen2.5-coder:14b": {} }
    }
  }
}
```

## Building releases

```bash
bun run --cwd packages/cli build       # terminal binaries
bun run --cwd packages/desktop build   # desktop app
bun run --cwd packages/desktop pack    # installers: .dmg, .exe, .AppImage, .deb, .rpm
```

Desktop auto-updates are published from this repository's GitHub Releases.

## Project layout

| Path | What's there |
| --- | --- |
| `packages/cli` | The `agartha` command-line entry point |
| `packages/tui` | Terminal UI |
| `packages/desktop` | Electron desktop app |
| `packages/core` | Agent, tools, sessions, providers and the permission layer, including the Gilles-Dini Monitor |
| `packages/server` | Local server shared by the TUI and desktop app |

## Credits and license

AgarthaOpen-Code is built on [opencode](https://github.com/anomalyco/opencode), used under the MIT License. See [NOTICE.md](NOTICE.md) for details.

AgarthaOpen-Code, the Gilles-Dini Monitor and all modifications are copyright © 2026 Jason Gilles, released under the [MIT License](LICENSE).
