# ZIP — limbrow.zip

`limbrow.zip` is Marc's net-art archive. A "social profile" rebuilt as code:
an Instagram-style 3-column grid where every tile is a real, interactive
HTML/CSS/JS artwork — not a static image. Marc is @limbrow on Instagram, this
is the link in his bio. Live at https://limbrow.zip.

## Stack

Vanilla HTML + CSS + ES modules. **No build step, no framework.** Hosted on
GitHub Pages with a CNAME for the custom domain. Tone.js (CDN) for audio in
Liserium; Aviary ships its own audio files. WebGL fragment shaders for the
two holes. Everything else is canvas 2D, SVG or plain DOM.

## Repo structure

Every post is a folder with `index.html` and usually a `preview.html` for its
grid card. Posts newest first:

```
~/Desktop/Limbrow/ZIP/
├── index.html              ← the 3-column grid
├── posts.js                ← post registry (slug, date, scale, preview, href)
├── avatar.jpg, favicon.png, apple-touch-icon.png, CNAME
├── about/                  ← references & influences (linked from the avatar)
├── arte/                   ← card for arte.zip: the brand piece, links out
├── whitehole/   + hole.js  ← time-reversed schwarzschild, the shadow develops into light
├── ascii/                  ← live text-mode editor, modules not screens
├── meltdown/               ← a screen that melts
├── singularity/            ← schwarzschild lensing, per-pixel geodesics
├── chukovski/              ← Repin 1910, the painting itself on a blurred backdrop
├── aviary/      + audio/   ← animated sky + flock, auto-singing
├── house-of-axes/          ← f(x)=1/x research plate (Marc's identity post)
├── liserium/    + sounds.js← Game Boy-styled dub-techno synth
├── game-of-life/           ← Conway's automaton with 50+ patterns
└── _template-slides/       ← reusable template for slide-format posts
```

URLs are clean: `limbrow.zip/<slug>/` (no `/p/` prefix anymore).

## The clean-up (14-sep-2026)

The feed used to hold 26 pieces. Marc cut it down to the big, consistent
ones — Liserium, Game of Life, the black hole and the white one — added
arte.zip, and the same night brought five back: house-of-axes, aviary, ascii,
meltdown and chukovski. The 17 retired posts (mandelbulb, botanica, ripples,
voronoi, chladni, attractors, turing, help, moire, physarum, leparc, blocks,
melt, loops, guess, ring, fractals) last lived in full at commit `bd4eeab`.
To bring one back:

```bash
git checkout bd4eeab -- fractals && git add fractals   # then re-register it in posts.js
```

**Chukovski came back in its original form** (`fb0ee62`): the painting as a
plain `<img>` on a blurred backdrop. The WebGL raking-light relief it was
given in `8a76ebb` — a commit whose message never mentioned it — was dropped,
the same way the meltdown, leparc and loops reworks were reverted in
`623d408`. Marc keeps the originals; don't re-dress an existing post.

## Posts that live elsewhere

`arte.zip` is Concreto Abstracto's Next.js platform (its own repo, its own
host). It cannot be iframed — it sends `X-Frame-Options: SAMEORIGIN` on
purpose — so its folder here only holds a `preview.html` that draws the
brand piece in canvas, and the registry entry carries `href:
'https://arte.zip'`, which the grid uses as the card's link instead of
`/arte/`. `arte/index.html` is a plain redirect for anyone who types the URL.

The piece follows the brand pack in the arte-zip repo
(`public/branding/pack.html`): seven square plates, each turned 15° from the
last, joined by a gap in the background colour; on a dark ground the grey
ramp inverts (light outside, black centre) and the prism colour lives only
on the edge of the four outer plates. Same numbers as the landing — if the
pack changes, change the card.

## Shared engines

Where a post and its card run the same simulation, the engine lives in its
own ES module in the post folder (`hole.js`) and both `index.html` and
`preview.html` import it. The HTML then only holds the chrome — panel,
gestures, credit. Before this, previews were hand-copied snapshots of the
engine and drifted out of sync with the post.

ES modules need a real origin, so `file://` won't run these. `.claude/serve.mjs`
is a ~30-line static server for local checks:

```bash
node .claude/serve.mjs
```

## Traps worth remembering

**Never compute a buffer size once from `window.innerWidth`.** A grid card is an
iframe, and an iframe can report width 0 at parse time. `0/0` is `NaN`, the
buffer gets allocated with height 0, `createImageData` throws, and the piece is
black *forever* because that size is never recomputed. Several retired posts
were dead this way. Always end the expression with `|| W`, or re-measure every
paint like the arte card does.

**The feed is live simulations, so it needs a budget.** `index.html` mounts
everything currently on screen plus a `HALO` of 3, and a card that drifts away
has its iframe *destroyed* — blanking `src` and removing the element is the
only way to be sure the buffers and the rAF loop are really gone. Mounting is
staggered one per 70ms, because starting a dozen engines in the same frame is
what made arriving at the page stutter. Five tiles don't need any of this;
the scheduler stays because the feed will grow again. Every shared engine
takes an `fps` option (0 = every animation frame, the default): cards run at
15–20fps, posts run uncapped. Where a piece advances one simulation step per
drawn frame, the preview raises `steps`/`iters` to match, so capping the paint
rate doesn't also slow the physics.

**Never put a fixed ceiling on how many cards may run.** Three columns of
square tiles put *eighteen* cards on an iPhone screen at once, so any ceiling
low enough to help performance is lower than what is actually visible, and the
rest of the screen sits black. Cap the halo, never the visible set.

**Don't trust one signal to drive the sweep.** `window.innerHeight` reads 0 in
an iframe and before layout, so rect arithmetic silently selects nothing.
`IntersectionObserver` and `scroll` do not fire at all in some embedded
viewers, and iOS coalesces scroll events during momentum. The grid therefore
measures rects (with a `vh > 0` guard and a fallback to the top of the grid),
listens to scroll/resize/load, *and* keeps a 500ms poll that re-sweeps only
when `scrollY` or the viewport height actually changed.

**Interpolate and light colour in LINEAR light,** not in sRGB. Blending
`rgb()` values directly is what makes gradients go chalky and grey through the
mid-tones. The engines here convert to linear, work there, and encode back
through a LUT — that single change is most of why the pieces read as
material rather than as coloured-in shapes.

## Post types

Genres established so far:

- **post-app** (Liserium, Game of Life, Singularity, Whitehole) — single-page
  interactive piece, often with a control panel
- **post-research-plate** (House of Axes) — dense editorial poster,
  intentional ALL CAPS labels, mathematical/typographic vibe
- **post-lab** — explorer tool with a floating glass panel: regime/map picker,
  palette chips, reseed, and a live readout of the actual parameters under
  the cursor (Fractals, Turing, Attractors, retired)

Plus `_template-slides/` for a future fourth genre: vertical-snap slide deck
(Tinder-style).

## Design system (the holes share it; Liserium intentionally doesn't)

Floating glass panel pattern:

- `background: rgba(8,10,22,0.65); backdrop-filter: blur(20px) saturate(140%)`
- Title row "● TITLE ▾" — clicking the head toggles `.minimized`
- Segmented controls for mode selection (not separate buttons)
- iOS-style toggles (not checkboxes)
- Slider thumbs glow purple (`#c8a4ff`)
- Mono font, all small-caps labels
- Mix-blend coords readout in the bottom-left corner

Liserium keeps its own Game Boy chassis as identity. The arte card speaks
arte.zip's language, not this one.

## Adding a post

```bash
mkdir my-new-post
$EDITOR my-new-post/index.html
# optionally: my-new-post/preview.html for a card-specific preview

# Register it in posts.js (newest first):
#   { slug: 'my-new-post', date: 'YYYY-MM-DD', preview: 'preview.html', scale: 1.0 }
#   add href: 'https://…' if the piece lives on another host

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
  spirit (Liserium ≠ the holes ≠ arte)
- Prefers a post's original version to a later redesign — three reworks were
  reverted in July and Chukovski's in September

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
