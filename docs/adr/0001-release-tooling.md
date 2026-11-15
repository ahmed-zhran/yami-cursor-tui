# Release tooling: semver + plain changelog entries

We ship one TUI deployable. Versions are semver tags `vX.Y.Z`. Changelog entries live under `.changes/unreleased/` and are compiled by the changelog skill at release finish — no Changesets or release-please until the package layout needs them.
