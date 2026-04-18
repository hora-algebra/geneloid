# GenericAlgoid

GenericAlgoid is a browser-based toroidal evolution sandbox.

Cells move, eat, reproduce, mutate, fight, and branch into visible lineages inside a closed material budget. The simulation is designed to be readable while it runs: the main screen shows the world, dominant lineages, lineage share, and quick controls, while separate guide and developer pages expose the underlying rules and diagnostics.

This repository is currently published at `hora-algebra/geneloid`.

## What It Simulates

- A toroidal world, so movement and sensing wrap across opposite edges.
- A fixed total material budget shared by organisms, debris, and spring-generated resources.
- Organisms with inherited movement, sensing, reproduction, and combat traits.
- Three gadget roles: melee, ranged, and shield.
- Terrain, springs, debris flow, mutation, and speciation into new lineages.
- A lineage dashboard that makes population shifts visible without opening devtools.

## Pages

- `index.html`: main simulation.
- `guide.html`: player-facing explanation of controls, rules, and reading strategies.
- `dev.html`: developer page for snapshots and debugging.

## Local Run

The app itself is plain HTML, CSS, and ES modules. For normal local use:

```bash
npm install
npm run local-server
```

Then open:

```text
http://127.0.0.1:4173/
```

Useful server commands:

```bash
npm run local-server:status
npm run local-server:restart
npm run local-server:stop
```

## Main Controls

- `Space`: run / pause.
- `R`: reset the world.
- `M`: toggle the menu.
- `F`: fullscreen.
- `D`: open the developer page.
- `P + drag`: feed the world with material.
- `S + click`: place or remove a spring.
- `H + drag`: sculpt mountains / terrain.
- `C + click`: deploy a custom lineage.
- `L + hold`: charge lightning and erase cells or springs.

## Validation And Analysis Scripts

- `npm run check`: fast simulation sanity check for mass conservation.
- `npm run verify-audio`: browser-level audio verification using Playwright and Chrome.
- `npm run profile`: performance profile of the simulation loop.
- `npm run balance`: broad ecosystem balance report.
- `npm run flock-balance`: flocking-oriented balance report.
- `npm run bias-check`: inspect directional or behavioral bias.
- `npm run terrain-balance`: terrain and mountain balance report.
- `npm run ecosystem-balance`: ecosystem-level balance report.
- `npm run dominance-balance`: dominance and winner-take-all pressure report.
- `npm run material-dominance-balance`: material concentration analysis.
- `npm run diversity-balance`: lineage diversity analysis.
- `npm run regional-balance`: spatial / regional balance analysis.

## Audio Assets

Curated background music is loaded from `assets/bgm/`. The main default file is:

- `assets/bgm/noru-they.mp3`

If the file is missing or fails to load, the app falls back to procedural ambient audio.

## Project Structure

- `src/`: simulation logic, UI wiring, guide content, audio, i18n, and rendering.
- `src/sim/`: core simulation engine and default configuration.
- `scripts/`: local server, verification, profiling, and balance-analysis utilities.
- `assets/`: audio assets and related notes.

## Tech Notes

- No frontend framework or build step is required.
- The local server is a small Node HTTP server in `scripts/local-server.mjs`.
- The only declared package dependency is `playwright-core`, used for browser verification scripts.
