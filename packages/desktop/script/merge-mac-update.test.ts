import { expect, test } from "bun:test"
import { merge } from "./merge-mac-update"

const arm = {
  version: "0.1.0",
  files: [{ url: "agarthaopen-code-desktop-mac-arm64.zip", sha512: "a", size: 1 }],
  path: "agarthaopen-code-desktop-mac-arm64.zip",
  sha512: "a",
  releaseDate: "2026-10-31T00:00:00.000Z",
}
const intel = {
  version: "0.1.0",
  files: [{ url: "agarthaopen-code-desktop-mac-x64.zip", sha512: "b", size: 2 }],
  path: "agarthaopen-code-desktop-mac-x64.zip",
  sha512: "b",
  releaseDate: "2026-10-31T00:00:00.000Z",
}

test("lists every architecture's files and keeps the Intel build as the fallback", () => {
  const merged = merge([arm, intel])
  expect(merged.files.map((file) => file.url)).toEqual([
    "agarthaopen-code-desktop-mac-arm64.zip",
    "agarthaopen-code-desktop-mac-x64.zip",
  ])
  expect(merged.path).toBe("agarthaopen-code-desktop-mac-x64.zip")
  expect(merged.sha512).toBe("b")
})

test("refuses to merge different versions", () => {
  expect(() => merge([arm, { ...intel, version: "0.2.0" }])).toThrow("versions differ")
})

test("refuses an empty input", () => {
  expect(() => merge([])).toThrow()
})
