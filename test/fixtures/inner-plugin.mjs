const record = (context, lifecycle, pluginConfig) => {
  context.calls.push({
    lifecycle,
    marker: pluginConfig.marker,
  })
}

export async function verifyConditions(pluginConfig, context) {
  record(context, "verifyConditions", pluginConfig)
}

export async function analyzeCommits(pluginConfig, context) {
  record(context, "analyzeCommits", pluginConfig)

  return pluginConfig.releaseType
}

export async function prepare(pluginConfig, context) {
  record(context, "prepare", pluginConfig)
}
