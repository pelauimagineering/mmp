<!--
This file is intended to help AI coding agents (Copilot-style) become productive
when working on this repository. It documents the repository's current state,
what an agent should ask next, and concrete, minimal actions the agent can take
to make progress. Keep this file short and focused — update it as the project
adds source code and CI/workflows.
-->

# Copilot instructions — poker-dealer

- **Repo snapshot:** Project description: "A digital card dealer for in-person sessions of a Texas
  Hold’em poker game." 

- **Primary goal for an agent:** Avoid guessing project specifics. First, ask
  the maintainer clarifying questions (see "Questions to ask").

## Questions to ask the maintainer (always ask these first)
- What programming language or runtime should this project use (Python, Node,
  Rust, other)?
- Is there existing code elsewhere (another branch, private repo, Gist)?
- Is this intended to run on a laptop, a Raspberry Pi, or embedded/hardware
  that interfaces with card shufflers/readers? Any special I/O (serial, BLE,
  GPIO)?
- Expected deliverables for the next task (examples): a minimal CLI dealer,
  a simulated web UI to manage hands, hardware integration, or unit-tested
  library API?
- Desired CI / testing setup (GitHub Actions, local pytest, nodetest, etc.)

## If user asks the agent to start implementing (minimal safe scaffold)
- Explain the chosen stack and confirm it in a short reply before coding.
- Create a minimal layout only after confirmation. Example (Python):
  - `pyproject.toml`, `README.md` (update), `src/poker_dealer/`, `tests/`
  - Implement a small, well-documented `src/poker_dealer/deck.py` with
    `Deck` and `Card` classes and a pure `shuffle()` function and unit tests.
- Example (Node.js): `package.json`, `src/`, `test/`, `src/deck.js` with
  deterministic shuffle tests.

## Conventions & priorities for this repository (current / recommended)
- Minimal surface area: prefer a small library with a tiny CLI wrapper rather
  than a large web app unless the maintainer requests it.
- Make state pure and testable: core dealing/shuffle logic should be
  deterministic and isolated from I/O (network, hardware) so unit tests can
  validate behavior without devices attached.
- Put real hardware integration into a separate module (e.g. `io/` or
  `hw/`) and mock it in tests.
- Focus on checking for security vulnerabilities.
- Point out complex logic that reduces readability.
- Check if the project's naming conventions (camelCase, etc.) are followed.
- Suggest adding test code if it is missing.

## What to commit and how
- Make small, focused commits; each commit should implement a single concept
  (deck representation, shuffle, hand evaluator, CLI). Use descriptive
  messages and open a PR for larger changes.

## Integration points to ask about / look for later
- Payment/analytics? (none found in repo)
- External services (auth, telemetry) — ask if required before adding.

## Useful file references
- `README.md` — source of truth for project intent (short at present).
- `.github/copilot-instructions.md` — this file; update as the codebase grows.

## When you are blocked
- Stop and ask the maintainer the specific question rather than guessing.

---
If anything above is unclear or you'd like the agent to scaffold a specific
language/framework, reply with the preferred stack and the first feature to
implement (for example: "Python, implement Deck.shuffle and tests").
