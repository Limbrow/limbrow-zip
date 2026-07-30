# ZIP — limbrow.zip

`limbrow.zip` is Marc's net-art archive. A "social profile" rebuilt as code:
an Instagram-style 3-column grid where every tile is a real, interactive
HTML/CSS/JS artwork — not a static image. Marc is @limbrow on Instagram, this
is the link in his bio. Live at https://limbrow.zip.

## Stack

Vanilla HTML + CSS + ES modules. **No build step, no framework.** Hosted on
GitHub Pages with a CNAME for the custom domain. Tone.js (CDN) for audio in
the synth posts. WebGL fragment shaders for the fractal explorer. Everything
else is canvas 2D or SVG.

## Repo structure

Every post is a folder with `index.html` and usually a `preview.html` for its
grid card. Posts newest first:

```
~/Projects/ZIP/
├── index.html              ← the 3-column grid
├── posts.js                ← post registry (slug, date, scale, preview)
├── avatar.jpg, favicon.png, apple-touch-icon.png, CNAME
├── about/                  ← references & influences (linked from the avatar)
├── mandelbulb/  + bulb.js  ← ray-marched 3D mandelbrot, drifting exponent
├── botanica/    + garden.js← l-system night garden, wind + seasons
├── ripples/     + tank.js  ← wave tank: reflection, diffraction, double slit
├── voronoi/     + cells.js ← leaded glass, four distance metrics
├── chladni/     + sand.js  ← sand finding the nodal lines of a square plate
├── attractors/  + plate.js ← long-exposure plate of strange attractors
├── turing/      + rd.js    ← gray-scott reaction–diffusion lab
├── ascii/                  ← live text-mode editor, modules not screens
├── meltdown/    + melt.js  ← a screen that melts (wax engine)
├── help/                   ← one track, "I can't get out", confined waveform
├── singularity/            ← schwarzschild lensing, per-pixel geodesics
├── moire/                  ← moiré editor, layered line/ring/radial/spiral
├── physarum/               ← competing slime-mould colonies, feed with cursor
├── leparc/      + plate.js ← modulation grid, in memory of Julio Le Parc
├── blocks/                 ← flat-colour rectangles, pixel-wipe transitions
├── melt/                   ← pixel-sorted glitch, auto-cycling modes
├── loops/       + curves.js← harmonic curves as 3D wire
├── chukovski/              ← Repin 1910 relit by a raking lamp (WebGL)
├── guess/                  ← looping typed opening, "Hola!"
├── aviary/      + audio/   ← animated sky + flock, auto-singing
├── ring/                   ← drone box, neon ring visualizer + cloud sky
├── fractals/               ← Mandelbrot/Julia/Burning Ship/Phoenix/Newton
├── house-of-axes/          ← f(x)=1/x research plate (Marc's identity post)
├── liserium/    + sounds.js← Game Boy-styled dub-techno synth
├── game-of-life/           ← Conway's automaton with 50+ patterns
└── _template-slides/       ← reusable template for slide-format posts
```

URLs are clean: `limbrow.zip/<slug>/` (no `/p/` prefix anymore).

## Shared engines

Where a post and its card run the same simulation, the engine lives in its own
ES module in the post folder (`melt.js`, `plate.js`, `rd.js`, `curves.js`) and
both `index.html` and `preview.html` import it. The HTML then only holds the
chrome — panel, gestures, credit. Before this, previews were hand-copied
snapshots of the engine and drifted out of sync with the post.

ES modules need a real origin, so `file://` won't run these. `.claude/serve.mjs`
is a ~30-line static server for local checks:

```bash
node .claude/serve.mjs
```

## Two traps worth remembering

**Never compute a buffer size once from `window.innerWidth`.** A grid card is an
iframe, and an iframe can report width 0 at parse time. `0/0` is `NaN`, the
buffer gets allocated with height 0, `createImageData` throws, and the piece is
black *forever* because that size is never recomputed. `blocks`, `physarum` and
`melt` were all dead this way. Always end the expression with `|| W`.

**The feed is 25 live simulations, so it needs a budget.** `index.html` keeps a
window: only cards near the viewport are mounted, never more than `MAX_LIVE`
(10 desktop / 6 mobile), and a card that drifts away has its iframe *destroyed*
— blanking `src` and removing the element is the only way to be sure the
buffers and the rAF loop are really gone. Mounting is staggered one per 130ms,
because starting a dozen engines in the same frame is what made arriving at the
page stutter. Every shared engine takes an `fps` option (0 = every animation
frame, the default): cards run at 15–20fps, posts run uncapped. Where a piece
advances one simulation step per drawn frame, the preview raises `steps`/`iters`
to match, so capping the paint rate doesn't also slow the physics.

**Never select cards by measuring rects against `window.innerHeight`.** It reads
0 in an iframe and before layout, and the arithmetic then quietly selects
nothing — a blank feed. Use `IntersectionObserver` and keep a fallback that
mounts the top of the grid if nothing reports as near.

**Interpolate and light colour in LINEAR light,** not in sRGB. Blending
`rgb()` values directly is what makes gradients go chalky and grey through the
mid-tones. Every engine here converts to linear, works there, and encodes back
through a LUT — that single change is most of why the newer posts read as
material (wax, glaze, emulsion) rather than as coloured-in shapes.

## Post types

Three established "genres" so far:

- **post-app** (Liserium, Game of Life, Ring) — single-page interactive piece,
  often with a control panel
- **post-research-plate** (House of Axes) — dense editorial poster, intentional
  ALL CAPS labels, mathematical/typographic vibe
- **post-lab** (Fractals, Turing, Attractors) — explorer tool with a floating
  glass panel: regime/map picker, palette chips, reseed, and a live readout of
  the actual parameters under the cursor

Plus `_template-slides/` for a future fourth genre: vertical-snap slide deck
(Tinder-style).

## Design system (Ring + Fractals share it; Liserium intentionally doesn't)

Floating glass panel pattern at the bottom of the screen:

- `position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%)`
- `background: rgba(8,10,22,0.65); backdrop-filter: blur(20px) saturate(140%)`
- Title row "● TITLE ▾" — clicking the head toggles `.minimized`
- Segmented controls for mode selection (not separate buttons)
- iOS-style toggles (not checkboxes)
- Slider thumbs glow purple (`#c8a4ff`)
- Mono font, all small-caps labels
- Mix-blend coords readout in the bottom-left corner

Liserium keeps its own Game Boy chassis as identity.

## Adding a post

```bash
mkdir my-new-post
$EDITOR my-new-post/index.html
# optionally: my-new-post/preview.html for a card-specific preview

# Register it in posts.js (newest first):
#   { slug: 'my-new-post', date: 'YYYY-MM-DD', preview: 'preview.html', scale: 1.0 }

git add my-new-post posts.js
git commit -m "add my-new-post"
git push
```

**Reserved slugs (don't use):** assets, api, static, css, js, about, contact,
index, posts, favicon — they would collide with site paths.

## Marc's preferences

- Spanish, casual tone, direct feedback over validation
- Hates over-engineering and unnecessary frameworks
- Wants every post to feel like a piece of art, not a demo
- Cares deeply about mobile (tests on iPhone first)
- Likes consistency in the design language but lets each post have its own
  spirit (Liserium ≠ Ring ≠ House of Axes)

## Deploy

GitHub Pages from `main`. Push → 60–90s → live. CNAME points limbrow.zip to
the GH Pages host.

```bash
git add -A
git commit -m "concise message"
git push
```

## Ideas in the backlog

ASCII camera (mic/webcam), echo chamber (mic + reverb), granular drone player,
glitch box, tile generator.

Done: slime mold → `physarum`, reaction-diffusion → `turing`, L-systems →
`botanica`, Mandelbulb → `mandelbulb`, Voronoi → `voronoi`.
