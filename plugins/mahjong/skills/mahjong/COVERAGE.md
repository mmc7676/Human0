# Coverage & parity map

| Req | Requirement | Where | Test |
|---|---|---|---|
| R1 | Full 152-tile set incl. 8 flowers, 8 jokers | engine `makeSet` | engine R1 |
| R2–R3 | Practice card: every hand 14 tiles, resolvable | engine `HANDS`, `buildConcretes` | engine R2, R3 |
| R4 | Deal East 14 / others 13, wall 99; East = SCW1 | `Game` ctor, `scwOf` | engine R4 |
| R5–R7 | Hand matching, joker limits (no singles/pairs), exposure consistency, concealed hands | `evalConcrete` | engine R5–R7 |
| R8 | Charleston conserves tiles; jokers can't be passed | `charlestonPass` | engine R8, UI test |
| R9 | Discarded joker is dead | `callOptions` | engine R9 |
| R10 | Joker exchange | `jokerSwaps`, `doSwap` | engine R10, UI test |
| R11 | NMJL-style payments (self-draw ×2, discarder ×2, jokerless ×2) | `finish` | engine R11 |
| R12 | Calls expose naturals before jokers; claimer takes turn | `applyCall` | engine R12 |
| R13 | Bots finish games, tiles conserved, winners verified, zero-sum (3 levels × 80 games) | `simulate` | engine R13-* |
| R14 | Three levels with different bot strength | `targetOptions`, `botWantsCall`, `tileScores` | engine R14 |
| R15 | SCW0 / SCW1–4 bounded views (private racks) | `scwView`, SCW tab | engine R15 |
| R16 | User can play full games in the real page (desktop + 390px phone), no JS errors | assets/mahjong.html | tests/ui.test.py |
| R17 | Built file embeds the exact engine source | build.py | assets/PARITY.json (`parity: true`) |
| R18 | Coach uses only info visible to the user | `coachData` → `options(U)` (own rack + public exposures/discards) | code review (no hidden-rack read) |

## Not modeled (known gaps)
- Blind passes in the Charleston (an optional table rule).
- Misnamed-tile and dead-hand penalties for the user. The app checks hands before you declare, so you can't make these mistakes; the Rules tab explains them.
- The real NMJL 2026 hands. They are copyrighted, so the game uses original practice hands instead.
