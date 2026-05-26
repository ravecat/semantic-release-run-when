import assert from "node:assert/strict"
import test from "node:test"

import runWhen from "../src/index.js"

const { analyzeCommits, prepare, verifyConditions } = runWhen

const context = (branch) => ({
  cwd: process.cwd(),
  branch,
})

test("skips loading the wrapped plugin when the predicate does not match", async () => {
  await prepare(
    {
      when: { branch: "beta" },
      plugin: "./test/fixtures/missing-plugin.mjs",
    },
    context({ name: "master", type: "release", main: true }),
  )
})

test("runs a wrapped plugin package path when branch criteria match", async () => {
  const releaseContext = context({
    name: "master",
    type: "release",
    main: true,
  })
  releaseContext.calls = []

  await prepare(
    {
      when: { branch: "master", type: "release", main: true },
      plugin: [
        "./test/fixtures/inner-plugin.mjs",
        {
          marker: "stable",
        },
      ],
    },
    releaseContext,
  )

  assert.deepEqual(releaseContext.calls, [
    {
      lifecycle: "prepare",
      marker: "stable",
    },
  ])
})

test("supports async predicate functions", async () => {
  const releaseContext = context({
    name: "beta",
    type: "prerelease",
    channel: "beta",
    prerelease: "beta",
  })
  releaseContext.calls = []

  const result = await analyzeCommits(
    {
      when: async ({ branch }) => branch.channel === "beta",
      plugin: [
        "./test/fixtures/inner-plugin.mjs",
        {
          releaseType: "minor",
        },
      ],
    },
    releaseContext,
  )

  assert.equal(result, "minor")
  assert.deepEqual(releaseContext.calls, [
    {
      lifecycle: "analyzeCommits",
      marker: undefined,
    },
  ])
})

test("passes global semantic-release plugin options to the wrapped plugin", async () => {
  const releaseContext = context({
    name: "master",
    type: "release",
    main: true,
  })
  releaseContext.receivedPluginConfig = undefined

  await prepare(
    {
      marker: "global",
      plugin: {
        prepare(pluginConfig, context) {
          context.receivedPluginConfig = pluginConfig
        },
      },
      when: { branch: "master" },
    },
    releaseContext,
  )

  assert.deepEqual(releaseContext.receivedPluginConfig, {
    marker: "global",
  })
})

test("lets wrapped plugin config override global plugin options", async () => {
  const releaseContext = context({
    name: "master",
    type: "release",
    main: true,
  })
  releaseContext.calls = []

  await prepare(
    {
      marker: "global",
      when: { branch: "master" },
      plugin: [
        "./test/fixtures/inner-plugin.mjs",
        {
          marker: "wrapped",
        },
      ],
    },
    releaseContext,
  )

  assert.deepEqual(releaseContext.calls, [
    {
      lifecycle: "prepare",
      marker: "wrapped",
    },
  ])
})

test("supports wrapped function plugins", async () => {
  const releaseContext = context({
    name: "master",
    type: "release",
    main: true,
  })
  releaseContext.calls = []

  const result = await analyzeCommits(
    {
      marker: "function",
      releaseType: "patch",
      when: { branch: "master" },
      plugin(pluginConfig, context) {
        context.calls.push({
          lifecycle: "function",
          marker: pluginConfig.marker,
        })

        return pluginConfig.releaseType
      },
    },
    releaseContext,
  )

  assert.equal(result, "patch")
  assert.deepEqual(releaseContext.calls, [
    {
      lifecycle: "function",
      marker: "function",
    },
  ])
})

test("matches prerelease branches by type, channel, and prerelease id", async () => {
  const releaseContext = context({
    name: "beta",
    type: "prerelease",
    channel: "beta",
    prerelease: "beta",
  })
  releaseContext.calls = []

  await verifyConditions(
    {
      when: { type: "prerelease", channel: "beta", prerelease: "beta" },
      plugin: "./test/fixtures/inner-plugin.mjs",
    },
    releaseContext,
  )

  assert.deepEqual(releaseContext.calls, [
    {
      lifecycle: "verifyConditions",
      marker: undefined,
    },
  ])
})

test("matches the default distribution channel with null", async () => {
  const releaseContext = context({
    name: "master",
    type: "release",
    channel: undefined,
    main: true,
  })
  releaseContext.calls = []

  await prepare(
    {
      when: { channel: null },
      plugin: "./test/fixtures/inner-plugin.mjs",
    },
    releaseContext,
  )

  assert.equal(releaseContext.calls.length, 1)
})

test("matches the default distribution channel with false inside an array", async () => {
  const releaseContext = context({
    name: "master",
    type: "release",
    channel: undefined,
    main: true,
  })
  releaseContext.calls = []

  await prepare(
    {
      when: { channel: [false, "beta"] },
      plugin: "./test/fixtures/inner-plugin.mjs",
    },
    releaseContext,
  )

  assert.equal(releaseContext.calls.length, 1)
})

test("throws semantic-release configuration errors for invalid wrapper options", async () => {
  await assert.rejects(
    () => prepare({ when: "master" }, context({ name: "master" })),
    (error) => error.semanticRelease === true && error.code === "ESEMANTICRELEASERUNWHENCONFIG",
  )
})
