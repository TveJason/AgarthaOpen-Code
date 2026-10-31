export * as GillesDini from "./gilles-dini.js"

/**
 * Gilles-Dini Monitor
 * ====================
 *
 * An external, tamper-resistant risk monitor for the AgarthaOpen-Code agent.
 *
 * The monitor sits in the permission layer, outside the model's reach: the agent cannot read,
 * reset or reconfigure it through any tool. Every permission request is scored, and each session
 * keeps a cumulative containment-risk budget. The monitor can only make a decision stricter:
 *
 *   allow  ->  ask    when an action is individually high-risk, or the session has spent past
 *                     the soft threshold of its budget
 *   allow  ->  ask    when a suspicious capability chain is detected (for example credential access
 *                     followed by network egress); unattended runs turn this into a deny
 *   any    ->  deny   when the session has exhausted its budget
 *
 * Configured denies always win. Zero-risk actions (reads, searches) are never restricted, so the
 * agent can always still look at the project and explain itself.
 *
 * Usage decays geometrically with each charged action, so a long, ordinary development session
 * of edits and builds settles well below the thresholds, while a burst of dangerous actions
 * crosses them quickly.
 *
 * Copyright (c) 2026 Jason Gilles. Part of AgarthaOpen-Code, released under the MIT License.
 */

export type Effect = "allow" | "ask" | "deny"

export type Capability = "destructive" | "egress" | "credential" | "privilege" | "persistence" | "remote-exec"

export interface Config {
  /** Set false to disable the monitor entirely. */
  readonly enabled: boolean
  /** Cumulative risk a session may spend before risky actions are denied. */
  readonly budget: number
  /** Fraction of the budget after which every risky action needs human approval. */
  readonly soft: number
  /** A single action scoring at or above this always needs human approval. */
  readonly single: number
  /** Multiplier applied to existing usage each time a new action is charged (0..1). */
  readonly decay: number
  /** How many recent actions are considered when looking for capability chains. */
  readonly window: number
}

export const defaults: Config = {
  enabled: true,
  budget: 30,
  soft: 0.6,
  single: 8,
  decay: 0.97,
  window: 20,
}

export interface Input {
  readonly sessionID: string
  readonly action: string
  readonly resources: ReadonlyArray<string>
}

export interface Assessment {
  readonly score: number
  readonly capabilities: ReadonlyArray<Capability>
  readonly reasons: ReadonlyArray<string>
}

export interface Verdict {
  readonly effect: Effect
  readonly assessment: Assessment
  readonly used: number
  readonly budget: number
  readonly message?: string
}

const BASE: Record<string, number> = {
  read: 0,
  glob: 0,
  grep: 0,
  list: 0,
  question: 0,
  todo: 0,
  skill: 0,
  edit: 0.25,
  webfetch: 0.5,
  websearch: 0.25,
  shell: 0.5,
  subagent: 0.5,
}

/** Unknown actions (MCP tools, plugins) get a modest default weight. */
const UNKNOWN = 1

interface Pattern {
  readonly test: RegExp
  readonly weight: number
  readonly capability: Capability
  readonly reason: string
}

const SHELL: ReadonlyArray<Pattern> = [
  {
    test: /\brm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r|--recursive\s+--force|--force\s+--recursive)\b|\bmkfs\b|\bdd\s+if=|\bshred\b|>\s*\/dev\/sd/i,
    weight: 6,
    capability: "destructive",
    reason: "destructive filesystem operation",
  },
  {
    test: /\bgit\s+(push\s+.*(--force|-f)\b|reset\s+--hard|clean\s+-[a-z]*f)|\bgit\s+push\s+--mirror/i,
    weight: 4,
    capability: "destructive",
    reason: "history-rewriting git operation",
  },
  {
    test: /\b(curl|wget|http|https)\b[^|]*\|\s*(sudo\s+)?(sh|bash|zsh|python3?|node)\b/i,
    weight: 7,
    capability: "remote-exec",
    reason: "piping downloaded content into an interpreter",
  },
  {
    test: /\bcurl\b.*(\s-d\b|--data|\s-F\b|--form|\s-T\b|--upload-file|-X\s*(POST|PUT))|\bwget\b.*--post|\b(nc|ncat|netcat|socat)\b|\bscp\b|\brsync\b.*:|\bssh\s+\S+@/i,
    weight: 4,
    capability: "egress",
    reason: "sending data off the machine",
  },
  {
    test: /\.ssh\/|id_(rsa|ed25519|ecdsa)|\.aws\/credentials|\.netrc|\.npmrc|\.pypirc|\.docker\/config|\bkeychain\b|\bsecurity\s+find-|(^|[\s/])\.env(\.|\b)|\bprintenv\b|^\s*env\s*$|\bgh\s+auth\s+token\b/i,
    weight: 4,
    capability: "credential",
    reason: "reading credentials or secrets",
  },
  {
    test: /(^|[;&|]\s*)(sudo|su|doas)\b|\bchmod\s+(-R\s+)?[0-7]*7{2}\b|\bchown\s+-R\b/i,
    weight: 5,
    capability: "privilege",
    reason: "privilege escalation or permission widening",
  },
  {
    test: /\bcrontab\b|\bsystemctl\s+(enable|start)\b|\blaunchctl\s+(load|bootstrap)\b|>>?\s*~?\/?[^\s]*\.(bashrc|zshrc|profile|bash_profile)\b|\bschtasks\b/i,
    weight: 4,
    capability: "persistence",
    reason: "installing persistence",
  },
]

const EDIT: ReadonlyArray<Pattern> = [
  {
    test: /(^|\/)\.env(\.|$)|(^|\/)\.ssh\/|\.aws\/|\.npmrc$|\.netrc$/i,
    weight: 4,
    capability: "credential",
    reason: "writing to a credentials or secrets file",
  },
  {
    test: /(^|\/)\.git\/hooks\/|(^|\/)\.github\/workflows\/|(^|\/)\.gitlab-ci\.yml$|(^|\/)\.husky\//i,
    weight: 3,
    capability: "persistence",
    reason: "changing hooks or CI that run automatically",
  },
  {
    test: /(^|\/)\.(bashrc|zshrc|profile|bash_profile)$/i,
    weight: 4,
    capability: "persistence",
    reason: "changing a shell startup file",
  },
]

/**
 * Capability chains that together look like coordinated misuse even when each step alone seems
 * reasonable. A chain is charged once, at the step that completes it.
 */
const CHAINS: ReadonlyArray<{ readonly from: Capability; readonly to: Capability; readonly weight: number; readonly reason: string }> = [
  { from: "credential", to: "egress", weight: 12, reason: "credential access followed by network egress" },
  { from: "credential", to: "remote-exec", weight: 10, reason: "credential access followed by remote code execution" },
  { from: "egress", to: "credential", weight: 8, reason: "network egress followed by credential access" },
  { from: "privilege", to: "persistence", weight: 8, reason: "privilege escalation followed by persistence" },
  { from: "remote-exec", to: "persistence", weight: 8, reason: "remote code execution followed by persistence" },
]

function base(action: string) {
  return BASE[action] ?? UNKNOWN
}

/** Scores one request on its own, without looking at session history. Pure. */
export function score(input: Pick<Input, "action" | "resources">): Assessment {
  const patterns = input.action === "shell" ? SHELL : input.action === "edit" ? EDIT : []
  const capabilities = new Set<Capability>()
  const reasons: string[] = []
  let total = base(input.action)
  for (const pattern of patterns) {
    if (!input.resources.some((resource) => pattern.test.test(resource))) continue
    total += pattern.weight
    capabilities.add(pattern.capability)
    reasons.push(pattern.reason)
  }
  return { score: total, capabilities: [...capabilities], reasons }
}

interface SessionState {
  used: number
  recent: Array<ReadonlyArray<Capability>>
}

export interface Monitor {
  readonly config: Config
  /** Decides how strict to be with this request. Does not charge the budget. */
  readonly assess: (input: Input) => Verdict
  /** Records that a request is going ahead (allowed, or put to the user). */
  readonly charge: (input: Input, verdict: Verdict) => void
  readonly usage: (sessionID: string) => number
  readonly reset: (sessionID: string) => void
}

function round(value: number) {
  return Math.round(value * 10) / 10
}

/** Returns the stricter of two effects. */
export function stricter(a: Effect, b: Effect): Effect {
  const rank = { allow: 0, ask: 1, deny: 2 } as const
  return rank[a] >= rank[b] ? a : b
}

export function make(overrides: Partial<Config> = {}): Monitor {
  const config: Config = { ...defaults, ...overrides }
  const sessions = new Map<string, SessionState>()

  const state = (sessionID: string) => {
    const existing = sessions.get(sessionID)
    if (existing) return existing
    const created: SessionState = { used: 0, recent: [] }
    sessions.set(sessionID, created)
    return created
  }

  const chains = (session: SessionState, capabilities: ReadonlyArray<Capability>) => {
    const seen = new Set([...session.recent.flat(), ...capabilities])
    return CHAINS.filter((chain) => seen.has(chain.from) && capabilities.includes(chain.to))
  }

  const assess = (input: Input): Verdict => {
    const single = score(input)
    const session = state(input.sessionID)
    const found = chains(session, single.capabilities)
    const assessment: Assessment = {
      score: single.score + found.reduce((sum, chain) => sum + chain.weight, 0),
      capabilities: single.capabilities,
      reasons: [...single.reasons, ...found.map((chain) => chain.reason)],
    }
    const used = session.used
    const projected = used * config.decay + assessment.score
    const summary = (verb: string) =>
      `Gilles-Dini Monitor ${verb}: risk ${round(projected)}/${config.budget}` +
      (assessment.reasons.length ? ` (${assessment.reasons.join("; ")})` : "")

    if (!config.enabled || assessment.score === 0)
      return { effect: "allow", assessment, used, budget: config.budget }
    if (projected >= config.budget)
      return { effect: "deny", assessment, used, budget: config.budget, message: summary("blocked this action") }
    if (found.length > 0 || assessment.score >= config.single || projected >= config.budget * config.soft)
      return { effect: "ask", assessment, used, budget: config.budget, message: summary("requires approval") }
    return { effect: "allow", assessment, used, budget: config.budget }
  }

  const charge = (input: Input, verdict: Verdict) => {
    if (!config.enabled || verdict.effect === "deny") return
    const session = state(input.sessionID)
    session.used = session.used * config.decay + verdict.assessment.score
    session.recent.push(verdict.assessment.capabilities)
    if (session.recent.length > config.window) session.recent.shift()
  }

  return {
    config,
    assess,
    charge,
    usage: (sessionID) => round(sessions.get(sessionID)?.used ?? 0),
    reset: (sessionID) => void sessions.delete(sessionID),
  }
}

/** Reads AGARTHA_GILLES_DINI (off|on) and AGARTHA_GILLES_DINI_BUDGET from the environment. */
export function fromEnvironment(env: Record<string, string | undefined> = process.env): Monitor {
  const flag = env.AGARTHA_GILLES_DINI?.toLowerCase()
  const budget = Number(env.AGARTHA_GILLES_DINI_BUDGET)
  return make({
    enabled: !(flag === "off" || flag === "0" || flag === "false"),
    ...(Number.isFinite(budget) && budget > 0 ? { budget } : {}),
  })
}
