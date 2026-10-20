# jrey8343/skills (archived)

These skills now live in [jrey8343/forge](https://github.com/jrey8343/forge), a private pi package, and only change there. Forge targets pi alone, so the Claude Code install paths this repo offered are gone.

This repo is archived and frozen at its last commit. **Don't install from it.** That means no `npx skills add jrey8343/skills`, no `claude plugin install jrey-skills@jrey8343`, and no `scripts/link-skills.sh`. A copy you install from here is stale and won't be updated.

If you installed these skills before, remove them:

```bash
# Claude Code plugin
claude plugin uninstall jrey-skills@jrey8343
claude plugin marketplace remove jrey8343

# skills.sh copies or link-skills.sh symlinks
# delete the matching entries under ~/.claude/skills
```

The delivery flow forked from [mattpocock/skills](https://github.com/mattpocock/skills). See [CREDITS.md](CREDITS.md) for the collections this one drew on.
