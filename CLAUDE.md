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

```
~/Projects/ZIP/
├── index.html              ← the 3-column grid
├── posts.js                ← post registry (slug, date, scale, preview)
├── avatar.jpg, favicon.png, apple-touch-icon.png, CNAME
├── ring/                   ← drone box with neon ring visualizer + cloud sky
│   ├── index.html
│   └── preview.html        ← silent orbital ring for the grid card
├── fractals/               ← Mandelbrot/Julia/Burning Ship/Phoenix/Newton explorer
│   ├── index.html
│   └── preview.html        ← random fractal each card load
├── house-of-axes/          ← f(x)=1/x research plate (Marc's identity post)
│   ├── index.html
│   └── preview.html        ← the animated red/blue hyperbola alone
├── liserium/               ← Game Boy-styled dub-techno synth
│   ├── index.html
│   ├── preview.html        ← LCD oscilloscope + sequencer crop
│   └── sounds.js
├── game-of-life/           ← Conway's automaton with 50+ patterns
│   ├── index.html
│   └── preview.html        ← auto-seeded live simulation
└── _template-slides/       ← reusable template for slide-format posts
    ├── index.html
    └── README.md
```

URLs are clean: `limbrow.zip/<slug>/` (no `/p/` prefix anymore).

## Post types

Three established "genres" so far:

- **post-app** (Liserium, Game of Life, Ring) — single-page interactive piece,
  often with a control panel
- **post-research-plate** (House of Axes) — dense editorial poster, intentional
  ALL CAPS labels, mathematical/typographic vibe
- **post-lab** (Fractals) — explorer tool with formula picker, palette,
  randomize, smooth/banded coloring

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

Slime mold (Physarum), reaction-diffusion (Turing patterns), L-systems,
ASCII camera (mic/webcam), echo chamber (mic + reverb), 3D Mandelbulb via
ray-marching, granular drone player, glitch box, Voronoi stretch, tile
generator.
