# CI with a 1Password service account

The only secret stored in GitHub is `OP_SERVICE_ACCOUNT_TOKEN`, for a service account with **read-only** access to the `<repo>-ci` vault. Each job loads the specific values it needs, at the step that needs them.

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4

      - name: Load deploy secrets
        id: op
        uses: 1password/load-secrets-action@v5
        with:
          export-env: false
        env:
          OP_SERVICE_ACCOUNT_TOKEN: ${{ secrets.OP_SERVICE_ACCOUNT_TOKEN }}
          CLOUDFLARE_API_TOKEN: op://<repo>-ci/CLOUDFLARE_API_TOKEN/password
          CLOUDFLARE_ACCOUNT_ID: op://<repo>-ci/CLOUDFLARE_ACCOUNT_ID/password

      - name: Deploy
        run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ steps.op.outputs.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ steps.op.outputs.CLOUDFLARE_ACCOUNT_ID }}
```

## Rules

- **`export-env: false`** with explicit `steps.<id>.outputs.<NAME>` references, so each value reaches only the step that names it. Loaded values are masked in logs.
- **Never give the service account token to an AI step**, such as `anthropics/claude-code-action`. Load the specific tokens that step needs in an earlier step, and pass only those.
- Use **read-only tokens** for anything an audit or analysis job uses (Sentry `org:read project:read event:read`, Cloudflare read-only). Deploy tokens live in a job that runs no model.
- Production deploys that also sync Worker secrets need the prod values. Either give a separate deploy-only service account read access to `<repo>-prod`, scoped to the `production` GitHub environment, or keep secret syncing a human-run `secrets:sync`. Recommend the latter for small teams.
- When migrating, delete the old GitHub secrets (`gh secret delete <NAME>`) after the first green run on the new path. Ask before deleting.

The `@v5` tag was the latest major in October 2026; check the action's README for the current version and inputs.
