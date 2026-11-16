# threejs-fps

A round-based tactical FPS on three.js — a make.fun bounty entry.

[![make.fun bounty](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02)
[![make.fun rank](https://make.fun/badge/threejs-fps-02/Jacktt55/threejs-fps/rank.svg)](https://make.fun/bounty/threejs-fps-02)
[![make.fun reward](https://make.fun/badge/threejs-fps-02/Jacktt55/threejs-fps/reward.svg)](https://make.fun/bounty/threejs-fps-02)

Two teams, short rounds, bots, a buy menu, and an objective — Counter-Strike-style, with our own map, art, sounds and names. It runs offline in a desktop browser from static files: `game/index.html` opens in Chrome and plays single-player against bots, no build step, no network request.

## Play it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome.

## Enter it

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

See the bounty: https://make.fun/bounty/threejs-fps-02
