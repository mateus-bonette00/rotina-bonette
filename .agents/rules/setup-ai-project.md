---
trigger: always_on
---

# Antigravity project policy bridge

Use `@AGENTS.md` as the canonical project instructions. Do not duplicate them here.

For repository navigation, prefer Graphify CLI (`graphify query`, `graphify path`, `graphify explain`) when a valid `graphify-out/` graph exists. Reuse the graph; refresh only after `git commit` or with `graphify update .` when needed. Never read `graphify-out/graph.json` directly.
