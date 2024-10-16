# Graphite CI

The Graphite CI action allows you to define _when_ to run CI.

Common optimizations include:

- Only running CI on the bottom N PRs of a [stack](https://stacking.dev)
- Only running CI once downstack CI has passed

## Usage

1. First, get your CI token from https://app.graphite.dev/ci
2. Set the CI token as a secret in your repository or organisation, named
   `GRAPHITE_CI_TOKEN` (or whatever you prefer).
3. Then, add the CI step to your workflow file:

```yml
steps:
  - name: Checkout
    uses: withgraphite/graphite-ci-action@main
    with:
      graphite_token: ${{ secrets.GRAPHITE_CI_TOKEN }}
```

To instead use a
[specific version](https://github.com/withgraphite/graphite-ci-action/tags) of
this action, replace `@main` with `@v1.0` (or whatever the current latest
version is).
