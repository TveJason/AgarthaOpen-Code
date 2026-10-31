import { resolveChannel } from "./utils"

const arg = process.argv[2]

const channel = arg === "dev" || arg === "beta" || arg === "prod" ? arg : resolveChannel()

const appId = channel === "prod" ? "com.agarthaopencode.desktop" : `com.agarthaopencode.desktop.${channel}`

const productName = channel === "prod" ? "AgarthaOpen-Code" : `AgarthaOpen-Code ${channel.charAt(0).toUpperCase() + channel.slice(1)}`

const summary = `Open source, model-agnostic AI coding agent${channel !== "prod" ? ` (${channel})` : ""}`

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<component type="desktop-application">
  <id>${appId}</id>

  <metadata_license>CC0-1.0</metadata_license>
  <project_license>MIT</project_license>

  <name>${productName}</name>
  <summary>${summary}</summary>

  <developer id="io.github.tvejason">
    <name>Jason Gilles</name>
  </developer>

  <description>
    <p>
      AgarthaOpen-Code is an open source agent that helps you write and run code with any AI model,
      guarded by the Gilles-Dini Monitor.
    </p>
  </description>

  <launchable type="desktop-id">${appId}.desktop</launchable>

  <content_rating type="oars-1.1" />

  <url type="bugtracker">https://github.com/TveJason/AgarthaOpen-Code/issues</url>
  <url type="homepage">https://github.com/TveJason/AgarthaOpen-Code</url>
  <url type="vcs-browser">https://github.com/TveJason/AgarthaOpen-Code</url>
</component>
`

await Bun.write(`resources/${appId}.metainfo.xml`, xml)

console.log(`Generated metainfo for ${channel} at resources/${appId}.metainfo.xml`)
