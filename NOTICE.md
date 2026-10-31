# Notice

**AgarthaOpen-Code** is created and maintained by Jason Gilles
(<https://github.com/TveJason>, [@RealJasonGilles](https://x.com/RealJasonGilles)).

Copyright (c) 2026 Jason Gilles. Released under the MIT License (see [LICENSE](LICENSE)).

## Original work

AgarthaOpen-Code is derived from **opencode** (<https://github.com/anomalyco/opencode>),
imported at commit `54988df055121398c9ee3eb2bafdeb98921088c7`.

opencode is Copyright (c) 2025 opencode and is distributed under the MIT License. Its
copyright and permission notice are retained in [LICENSE](LICENSE), as the MIT License requires.

AgarthaOpen-Code is an independent project. It is not affiliated with, sponsored by, or endorsed by
the opencode project or its authors.

## What AgarthaOpen-Code adds

- The **Gilles-Dini Monitor** (`packages/core/src/gilles-dini.ts`): an external cumulative
  containment-risk monitor in the permission layer.
- Plan mode asks for permission before running any shell command.
- AgarthaOpen-Code branding: the `agartha` command, terminal wordmark, desktop app identity
  (`com.agarthaopencode.desktop`, `agartha://` links) and update feed from this repository's releases.

Internal package names (`@opencode/*`), the `opencode.json` config file name, and `OPENCODE_*`
environment variables are kept for now so the codebase stays buildable and easy to merge with upstream.
