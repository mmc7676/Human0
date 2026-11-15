---
name: mahjong
description: Launch a single-player American Mah Jongg game (NMJL-style 2026 rules) inline in chat against three computer players who can also win, with Beginner/Intermediate/Advanced levels and a built-in coach. Use for /mahjong or "play mahjong".
---

# /mahjong — American Mah Jongg coach game

A full American Mah Jongg game that you play in the chat window. Three computer players (Rose, Pearl, Hazel) play by the same rules and can win. The game teaches as you play.

## What's in the package

```
mahjong/
  SKILL.md              this file
  CHATGPT.md            how to play the same game in ChatGPT
  COVERAGE.md           requirement → code → test map
  assets/mahjong.html   THE GAME: one self-contained file (no network, no dependencies)
  assets/PARITY.json    sha256 proof that the embedded engine == src/engine.js
  src/engine.js         rules engine (pure JS, also runs in Node)
  src/ui.html           table, racks, coach, card, SCW panel (template)
  build.py              inlines engine into ui → assets/mahjong.html (optional --logo)
  tests/engine.test.js  rules + 240 full bot games + level-strength check
  tests/ui.test.py      headless browser plays whole games as the user (desktop + phone)
```

## How to launch (Claude)

1. Read `assets/mahjong.html` from this skill folder. Do not rewrite or summarize it. Use the file exactly as it is.
2. Show it to the user in this order of preference:
   - **Inline:** render the whole file with the inline HTML visual tool (show_widget), passing the file contents unchanged (no DOCTYPE/html/head/body stripping is needed if the tool accepts full documents; if it requires a fragment, pass the contents of `<body>` plus the `<style>` block).
   - **Artifact:** if inline rendering is not available, or the user wants to keep or share the game, publish the file as an HTML artifact titled "Mahjong".
   - **File:** otherwise send `assets/mahjong.html` so the user can open it in any browser.
3. Say one line: "Pick a level and press **Deal the tiles**. The Coach tab explains every step."
4. Don't play the user's turns for them. If they ask questions mid-game ("what's a Kong?", "why can't I pass a Joker?"), answer from the Rules section below.

If the user names a level ("/mahjong advanced"), tell them to pick it on the start screen. The level choice is saved in the browser where storage is allowed.

## Game design (what the user gets)

- **Full 152-tile set** that matches a standard American set: Bams, Craks and Dots 1–9 ×4 each; Green, Red and White (Soap) dragons ×4; N/E/W/S winds ×4; 8 Flowers; 8 Jokers.
- **Racks** for all four players. Exposures sit on the top shelf of each rack. Bot racks are face down until the game ends.
- **Mat and wall:** a blue-and-white mat, four walls of 19 stacks that empty in order, and a center discard pool with the latest discard highlighted.
- **Phases:** a 1st Charleston (right, across, left; required), an optional 2nd Charleston (left, across, right; any player can stop it), an optional courtesy pass across (0–3 tiles), then play. East discards first and play moves to the right.
- **Calls:** you can call a discard for a Pung, Kong, Quint, Sextet, or Mah Jongg. A Mah Jongg call beats an exposure call. Between equal calls, the player next in turn wins. Discarded Jokers are dead.
- **Jokers:** they work in groups of 3 or more, never in singles or pairs. You can swap a real tile for a Joker in anyone's exposure.
- **Scoring:** everyone pays the hand's value. On a self-drawn win everyone pays double. On a discard win the discarder pays double. A jokerless hand doubles the value (except Singles & Pairs). Running scores are kept.
- **Levels:**
  - *Beginner:* gentle bots. The coach is always on: it marks a suggested discard with a red dot and outlines tiles to keep in green.
  - *Intermediate:* bots go for their best hand and call tiles. Unlimited Hint button.
  - *Advanced:* defensive bots that swap jokers. 3 hints per game.
- **Coach:** it shows your 3 closest hands with progress bars, the exact tiles you still need, the suggested discard and why, and advice on calls and joker swaps. You can pin any hand on the Card as your target. The coach only uses what you can see: your rack and the public tiles.
- **Card tab:** the Human0 Practice Card has 23 original hands in 8 categories, color-coded by suit like the real card. It shows X (exposed) or C (concealed) and the value.

## SCW structure

```
SCW0  game container: wall, discards, turn, phase (public)
 ├─ SCW1  East  (goes first)  private rack + exposures
 ├─ SCW2  South
 ├─ SCW3  West
 └─ SCW4  North
```
SCW numbers follow the winds, so East is always SCW1 even after the dealer rotates. Every log line is tagged with its SCW. The SCW tab can copy the public SCW state as JSON. Other players' racks stay hidden until the game ends.

## The card and copyright

The 2026 NMJL card is copyrighted, and the League doesn't allow reproduction without approval. So this game does **not** include the League's hands. It uses original practice hands built from the same parts (year, evens, like numbers, runs, odds, winds and dragons, 3-6-9, singles and pairs). The rules are summarized in our own words and follow 2026 NMJL standard play. Players with their own 2026 card get the same rules and skills here; only the list of hands is different.

## Rules quick reference (for answering questions)

- Pair = 2, Pung = 3, Kong = 4, Quint = 5, Sextet = 6.
- Matching dragons: Craks go with Red, Bams with Green, Dots with Soap. The Soap can be used as 0.
- You can't pass Jokers in the Charleston.
- You can call a tile only for an exposure (3 or more tiles) or to win. Once you call, you expose the group and then discard.
- Jokers are never used in singles or pairs. A discarded Joker can't be picked up.
- A false Mah Jongg makes the hand dead. The app checks your hand before you declare, so you can't make this mistake.
- Wall game: the wall runs out and nobody is paid.

## Rebuild and verify

```
node tests/engine.test.js        # expect: 17 passed, 0 failed
python3 build.py [--logo logo.png]  # expect: "parity": true
python3 tests/ui.test.py         # expect: UI tests passed, no page errors
```
