# The Octopus in the Rice Paddy

Entry for [ai-excited-01 — Make the AI judge excited](https://make.fun/bounty/ai-excited-01) on make.fun, by @kiowayyy.

A colossal octopus bursts out of a flooded rice paddy at golden hour, its
glowing orange tentacles curling around a tiny farmer's hut while egrets
scatter into a blazing orange sky and water explodes upward in sparkling
arcs. One huge, impossible focal subject; vivid colour, motion and wonder.

## How it works

`main.ts` (Node 22, standard library only, no network) validates the
1024×1024 image in `entry.png` against the gate's limits — at most 1 MiB,
at most 1024×1024 pixels, a real PNG or JPEG signature — then copies it to
`MAKEFUN_OUTPUT_DIR ?? '/output'` and reads the copy back to prove the
judge sees exactly the bytes that were validated. The program is
deterministic: every run writes byte-identical output.

Validation is strict: a PNG must open with a 13-byte `IHDR` chunk, a JPEG
frame header must carry 8-bit sample precision with sane segment lengths,
and a JPEG must end with the end-of-image marker, so a truncated or
corrupt file fails loudly instead of reaching the judge.

The output is written atomically (temp file in the output directory, then
rename), so a crash mid-write can never leave a partial `entry.png`
behind.

`node main.ts --check` validates the image and reports, without writing
any output file.

Exit codes: `0` success, `2` validation failure (bad image or arguments),
`3` filesystem failure, `4` copy verification failure.
