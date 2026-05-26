import process from "node:process"

export default {
  branches: [process.env.DEFAULT_BRANCH || "master", { name: "beta", prerelease: true }],
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    [
      "./src/index.js",
      {
        plugin: "@semantic-release/changelog",
        when: { main: true },
      },
    ],
    "@semantic-release/npm",
    [
      "./src/index.js",
      {
        plugin: [
          "@semantic-release/git",
          {
            assets: ["CHANGELOG.md", "package.json", "pnpm-lock.yaml"],
          },
        ],
        when: { main: true },
      },
    ],
    "@semantic-release/github",
  ],
  // biome-ignore lint/suspicious/noTemplateCurlyInString: semantic-release placeholder
  tagFormat: "${version}",
}
