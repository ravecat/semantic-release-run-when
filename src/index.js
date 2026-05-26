import { createRequire } from "node:module"
import path from "node:path"
import { pathToFileURL } from "node:url"

import SemanticReleaseError from "@semantic-release/error"

const CONFIGURATION_ERROR = "ESEMANTICRELEASERUNWHENCONFIG"

const branchMatchers = {
  branch: "name",
  name: "name",
  type: "type",
  channel: "channel",
  main: "main",
  prerelease: "prerelease",
}

const pluginCache = new Map()

const configurationError = (message) => {
  return new SemanticReleaseError(
    message,
    CONFIGURATION_ERROR,
    "Check the semantic-release-run-when plugin configuration.",
  )
}

const isPlainObject = (value) =>
  value !== null &&
  typeof value === "object" &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)

const normalizeDefaultChannel = (value) => (value === undefined || value === false ? null : value)

const normalizeChannelCriteria = (value) =>
  Array.isArray(value)
    ? value.map((item) => normalizeChannelCriteria(item))
    : normalizeDefaultChannel(value)

const normalizePlugin = (pluginDefinition) => {
  if (Array.isArray(pluginDefinition)) {
    if (pluginDefinition.length < 1 || pluginDefinition.length > 2) {
      throw configurationError(
        'The "plugin" tuple must contain a plugin and optional config object.',
      )
    }

    const [plugin, pluginConfig = {}] = pluginDefinition

    if (!isPlainObject(pluginConfig)) {
      throw configurationError('The wrapped "plugin" config must be a plain object.')
    }

    return { plugin, pluginConfig }
  }

  if (isPlainObject(pluginDefinition) && "path" in pluginDefinition) {
    const { path: plugin, ...pluginConfig } = pluginDefinition

    return { plugin, pluginConfig }
  }

  return { plugin: pluginDefinition, pluginConfig: {} }
}

const normalizeConfig = ({ plugin, when = true, ...globalPluginConfig } = {}) => {
  if (typeof when !== "boolean" && typeof when !== "function" && !isPlainObject(when)) {
    throw configurationError('The "when" option must be a boolean, function, or plain object.')
  }

  const normalizedPlugin = normalizePlugin(plugin)

  if (!normalizedPlugin.plugin) {
    throw configurationError('The "plugin" option is required.')
  }

  return {
    when,
    globalPluginConfig,
    ...normalizedPlugin,
  }
}

const matchesValue = (actualValue, expectedValue) => {
  if (Array.isArray(expectedValue)) {
    return expectedValue.some((value) => matchesValue(actualValue, value))
  }

  if (expectedValue instanceof RegExp) {
    return expectedValue.test(String(actualValue ?? ""))
  }

  return Object.is(actualValue, expectedValue)
}

const matchesBranch = (branch, criteria) => {
  for (const [criteriaKey, expectedValue] of Object.entries(criteria)) {
    const branchKey = branchMatchers[criteriaKey]

    if (!branchKey) {
      throw configurationError(`Unsupported branch criteria "${criteriaKey}".`)
    }

    const actualValue =
      branchKey === "channel" ? normalizeDefaultChannel(branch?.channel) : branch?.[branchKey]
    const normalizedExpectedValue =
      branchKey === "channel" ? normalizeChannelCriteria(expectedValue) : expectedValue

    if (!matchesValue(actualValue, normalizedExpectedValue)) {
      return false
    }
  }

  return true
}

const shouldRun = async (when, context) => {
  if (typeof when === "boolean") {
    return when
  }

  if (typeof when === "function") {
    return Boolean(await when(context))
  }

  return matchesBranch(context.branch, when)
}

const resolvePlugin = (plugin, cwd) => {
  const requireFromProject = createRequire(path.join(cwd, "package.json"))
  return requireFromProject.resolve(plugin)
}

const loadPlugin = async (plugin, context) => {
  if (typeof plugin === "function" || isPlainObject(plugin)) {
    return plugin
  }

  if (typeof plugin !== "string") {
    throw configurationError(
      'The wrapped "plugin" must be a string, function, plugin object, or [plugin, config] tuple.',
    )
  }

  const cwd = context.cwd ?? process.cwd()
  const cacheKey = `${cwd}\0${plugin}`

  if (!pluginCache.has(cacheKey)) {
    const pluginPath = resolvePlugin(plugin, cwd)
    const loadedPlugin = await import(pathToFileURL(pluginPath).href)
    pluginCache.set(cacheKey, loadedPlugin.default ?? loadedPlugin)
  }

  return pluginCache.get(cacheKey)
}

const runLifecycle = (lifecycle) => async (pluginConfig, context) => {
  const normalizedConfig = normalizeConfig(pluginConfig)

  if (!(await shouldRun(normalizedConfig.when, context))) {
    return undefined
  }

  const plugin = await loadPlugin(normalizedConfig.plugin, context)
  const wrappedPluginConfig = {
    ...normalizedConfig.globalPluginConfig,
    ...normalizedConfig.pluginConfig,
  }

  if (typeof plugin === "function") {
    return await plugin(wrappedPluginConfig, context)
  }

  const run = plugin[lifecycle]

  if (typeof run !== "function") {
    return undefined
  }

  return await run(wrappedPluginConfig, context)
}

const verifyConditions = runLifecycle("verifyConditions")
const analyzeCommits = runLifecycle("analyzeCommits")
const verifyRelease = runLifecycle("verifyRelease")
const generateNotes = runLifecycle("generateNotes")
const addChannel = runLifecycle("addChannel")
const prepare = runLifecycle("prepare")
const publish = runLifecycle("publish")
const success = runLifecycle("success")
const fail = runLifecycle("fail")

export default {
  verifyConditions,
  analyzeCommits,
  verifyRelease,
  generateNotes,
  addChannel,
  prepare,
  publish,
  success,
  fail,
}
