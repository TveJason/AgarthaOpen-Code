import { app } from "electron"

type Channel = "local" | "dev" | "beta" | "prod"

const raw = import.meta.env.OPENCODE_CHANNEL

export const CHANNEL: Channel = raw === "local" || raw === "dev" || raw === "beta" || raw === "prod" ? raw : "dev"

export const VERSION = app.isPackaged ? app.getVersion() : (process.env.OPENCODE_VERSION ?? app.getVersion())

const appNames: Record<string, string> = {
  dev: "AgarthaOpen-Code Dev",
  beta: "AgarthaOpen-Code Beta",
  prod: "AgarthaOpen-Code",
}

const appIDs: Record<string, string> = {
  dev: "com.agarthaopencode.desktop.dev",
  beta: "com.agarthaopencode.desktop.beta",
  prod: "com.agarthaopencode.desktop",
}

// Local renderer/server mode keeps the dev application identity.
export const APP_NAME = app.isPackaged ? appNames[CHANNEL] : "AgarthaOpen-Code Dev"

export const APP_ID = app.isPackaged ? appIDs[CHANNEL] : "com.agarthaopencode.desktop.dev"
