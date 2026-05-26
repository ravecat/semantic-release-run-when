# semantic-release-run-when

Conditional wrapper plugin for [semantic-release](https://semantic-release.gitbook.io/semantic-release/).

Use it when a plugin should run only on selected [release branches or channels](https://semantic-release.gitbook.io/semantic-release/usage/workflow-configuration) while the rest of the release pipeline stays unchanged.

## Why use it?

[semantic-release runs every configured plugin](https://semantic-release.gitbook.io/semantic-release/usage/plugins#plugins-declaration-and-execution-order) for each release step the plugin implements. That is a good default, but it makes conditional execution awkward when only one plugin should run on a specific branch or channel.

Without a wrapper, this usually pushes the condition into custom JavaScript config, duplicated release configs, or a custom plugin. `semantic-release-run-when` keeps the rule declarative: wrap the target [`plugin`](#plugin), set [`when`](#when), and keep the release config compact.

## Install

| Package manager | Command                                            |
| --------------- | -------------------------------------------------- |
| pnpm            | `pnpm add -D semantic-release-run-when`            |
| npm             | `npm install --save-dev semantic-release-run-when` |
| yarn            | `yarn add --dev semantic-release-run-when`         |

## Development

Requirements:

- Node.js `>=24`
- pnpm `10.26.2`

Install these requirements with any tools available to you, or use the repository Nix Flake to provide them.

<details>
<summary>Prepare Nix environment</summary>

This prepares host tooling only. Node.js, pnpm, and Git come from the repository Flake.

Official docs:

- [Nix installation](https://nixos.org/download/)
- [Nix flakes](https://nix.dev/concepts/flakes)
- [direnv installation](https://direnv.net/docs/installation.html)
- [direnv shell hook](https://direnv.net/docs/hook.html)
- [nix-direnv](https://github.com/nix-community/nix-direnv)

Linux multi-user Nix install:

```sh
sh <(curl --proto '=https' --tlsv1.2 -L https://nixos.org/nix/install) --daemon
```

Enable flakes:

```sh
mkdir -p ~/.config/nix
printf "experimental-features = nix-command flakes\n" >> ~/.config/nix/nix.conf
```

Optional direnv and nix-direnv setup through Nix:

```sh
nix profile install nixpkgs#direnv nixpkgs#nix-direnv
mkdir -p ~/.config/direnv
printf 'source $HOME/.nix-profile/share/nix-direnv/direnvrc\n' >> ~/.config/direnv/direnvrc
```

Add the direnv hook for your shell. For bash:

```sh
printf 'eval "$(direnv hook bash)"\n' >> ~/.bashrc
```

For other shells, use the [direnv hook docs](https://direnv.net/docs/hook.html).

</details>

<br>

Prepare the environment with Nix:

```sh
nix develop
```

Or authorize automatic loading once:

```sh
direnv allow
```

After that, entering the repository directory loads the Flake environment automatically.

Local development variables can be placed in `envs/.env`. Use `envs/.env.example` as the template.

Install dependencies and run checks:

```sh
pnpm install --frozen-lockfile
pnpm run check
```

## Usage

`semantic-release-run-when` wraps one [semantic-release plugin](https://semantic-release.gitbook.io/semantic-release/usage/plugins). The wrapped plugin is loaded from the project where semantic-release runs.

The wrapped plugin receives semantic-release global plugin options first and its nested plugin config on top, matching semantic-release's normal plugin option merge behavior.

This example uses semantic-release [`branches`](https://semantic-release.gitbook.io/semantic-release/usage/configuration#branches) and [`plugins`](https://semantic-release.gitbook.io/semantic-release/usage/plugins) configuration. See [`plugin`](#plugin) for wrapper config formats, [`when`](#when) for branch matching, and [Lifecycle Behavior](#lifecycle-behavior) for forwarding rules.

```js
export default {
  branches: ["master", { name: "beta", prerelease: true }],
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    [
      "semantic-release-run-when",
      {
        when: { branch: "master" },
        plugin: [
          "@semantic-release/changelog",
          {
            changelogFile: "CHANGELOG.md",
            changelogTitle: "# Changelog",
          },
        ],
      },
    ],
    "@semantic-release/npm",
    [
      "semantic-release-run-when",
      {
        when: { branch: "master" },
        plugin: [
          "@semantic-release/git",
          {
            assets: ["CHANGELOG.md", "package.json", "pnpm-lock.yaml"],
            message:
              "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
          },
        ],
      },
    ],
    "@semantic-release/github",
  ],
};
```

This keeps `CHANGELOG.md` and release commits on the stable branch while allowing pre-release branches to keep publishing npm and GitHub release artifacts.

## Options

### `plugin`

Required. The [semantic-release plugin](https://semantic-release.gitbook.io/semantic-release/usage/plugins) to wrap.

It accepts the same common forms used in semantic-release [plugin configuration](https://semantic-release.gitbook.io/semantic-release/usage/plugins#plugin-options-configuration):

```js
{
  plugin: "@semantic-release/changelog";
}
```

```js
{
  plugin: [
    "@semantic-release/changelog",
    {
      changelogFile: "CHANGELOG.md",
    },
  ];
}
```

```js
{
  plugin: {
    path: "@semantic-release/changelog",
    changelogFile: "CHANGELOG.md",
  }
}
```

Inline plugin functions and plugin objects are also supported in JavaScript configs.

### `when`

Optional. Defaults to `true`.

Pass a function for full control:

```js
{
  when: ({ branch }) => branch?.type === "release" && branch?.main === true;
}
```

Pass an object for branch matching:

```js
{
  when: {
    branch: "master",
    type: "release",
    channel: null,
    main: true
  }
}
```

Supported criteria match the [`context.branch`](https://semantic-release.gitbook.io/semantic-release/developer-guide/plugin) object provided to semantic-release plugins:

- `branch` or `name` - matches `context.branch.name`
- `type` - matches `context.branch.type`
- `channel` - matches `context.branch.channel`; use `null` for the default distribution channel
- `main` - matches `context.branch.main`
- `prerelease` - matches `context.branch.prerelease`

Each criterion value can be a scalar, array, or regular expression in JavaScript configs.

## Lifecycle Behavior

The wrapper exports the [semantic-release lifecycle methods](https://semantic-release.gitbook.io/semantic-release/developer-guide/plugin) and forwards each matching lifecycle to the wrapped [`plugin`](#plugin) only when [`when`](#when) matches.

If the branch does not match, the wrapped plugin is not loaded or executed for that lifecycle.

If the branch matches but the wrapped [`plugin`](#plugin) does not implement that [lifecycle method](https://semantic-release.gitbook.io/semantic-release/developer-guide/plugin), the wrapper does nothing for that lifecycle.
