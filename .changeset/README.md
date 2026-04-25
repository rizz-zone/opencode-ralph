# Changesets

This directory is managed by `@changesets/cli`.

Add a changeset for user-facing changes:

```sh
bun run changeset
```

The release workflow creates version PRs and publishes with npm trusted publishing/provenance once npm is configured to trust the GitHub Actions workflow.
