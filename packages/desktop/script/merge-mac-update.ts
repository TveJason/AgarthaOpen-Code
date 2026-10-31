#!/usr/bin/env bun
// AgarthaOpen-Code release helper. Each macOS architecture is packaged in its own job, and each job writes a
// latest-mac.yml listing only its own files. electron-updater reads a single latest-mac.yml and picks the file for
// the running CPU from its `files` list, so the release needs one file that lists both architectures.
//
// Usage: bun script/merge-mac-update.ts <output> <latest-mac.yml> [<latest-mac.yml> ...]

export interface UpdateFile {
  readonly url: string
  readonly sha512: string
  readonly size?: number
  readonly [key: string]: unknown
}

export interface UpdateInfo {
  readonly version: string
  readonly files: ReadonlyArray<UpdateFile>
  readonly path?: string
  readonly sha512?: string
  readonly releaseDate?: string
  readonly [key: string]: unknown
}

export function merge(inputs: ReadonlyArray<UpdateInfo>): UpdateInfo {
  if (inputs.length === 0) throw new Error("No latest-mac.yml files to merge")
  const versions = new Set(inputs.map((input) => input.version))
  if (versions.size !== 1) throw new Error(`latest-mac.yml versions differ: ${[...versions].join(", ")}`)
  const files = new Map<string, UpdateFile>()
  for (const input of inputs) for (const file of input.files) files.set(file.url, file)
  // The top-level path/sha512 are a legacy fallback for old updaters; prefer the Intel build, which runs on both.
  const primary = inputs.find((input) => !String(input.path ?? "").includes("arm64")) ?? inputs[0]!
  return { ...primary, files: [...files.values()] }
}

if (import.meta.main) {
  const [output, ...sources] = process.argv.slice(2)
  if (!output || sources.length === 0) {
    console.error("Usage: bun script/merge-mac-update.ts <output> <latest-mac.yml> [<latest-mac.yml> ...]")
    process.exit(1)
  }
  const inputs = await Promise.all(sources.map(async (file) => Bun.YAML.parse(await Bun.file(file).text()) as UpdateInfo))
  const merged = merge(inputs)
  await Bun.write(output, Bun.YAML.stringify(merged, null, 2) + "\n")
  console.log(`Merged ${sources.length} files into ${output}: ${merged.files.map((file) => file.url).join(", ")}`)
}
