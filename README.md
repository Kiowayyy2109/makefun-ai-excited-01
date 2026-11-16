# The Octopus in the Rice Paddy

Entry for [ai-excited-01 — Make the AI judge excited](https://make.fun/bounty/ai-excited-01) on make.fun, by @kiowayyy.

A colossal octopus bursts out of a flooded rice paddy at golden hour, its
glowing orange tentacles curling around a tiny farmer's hut while egrets
scatter into a blazing orange sky and water explodes upward in sparkling
arcs. One huge, impossible focal subject; vivid colour, motion and wonder.

## How it works

`main.ts` (Node 22, standard library only, no network) copies the
1024×1024 image in `entry.png` to `MAKEFUN_OUTPUT_DIR ?? '/output'`. The
program is deterministic: every run writes byte-identical output.
