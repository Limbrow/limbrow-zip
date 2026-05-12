# limbrow.zip

> Netart archive by [limbrow](https://limbrow.com). A profile, but in code.

Every post is a folder of HTML/CSS/JS that runs live in a 3-column grid. Like Instagram, but each tile is a real, interactive piece — generative art, micro-tools, sketches, visualizers, synths.

Live at **[limbrow.zip](https://limbrow.zip)**.

## How it works

```
limbrow.zip/
├── index.html        ← 3-column IG-style grid
├── posts.js          ← post registry
├── avatar.jpg
├── favicon.png
├── apple-touch-icon.png
└── <slug>/           ← every post is a folder in the root
    ├── index.html
    └── preview.html  (optional)
```

Each post is self-contained inside `/<slug>/`. The folder can hold any HTML/CSS/JS/assets it needs — everything stays local to that post.

URLs are clean: `limbrow.zip/<slug>/` (no `/p/` prefix).

## Adding a post

```bash
mkdir sketch-042
$EDITOR sketch-042/index.html

# Add to posts.js:
#   {
#       slug: 'sketch-042',
#       date: '2026-05-13',
#       scale: 0.4            // optional: preview zoom-out
#   }

git add sketch-042 posts.js
git commit -m "add sketch-042"
git push
```

## Slug rules

Slugs live in the root namespace alongside `index.html`, `assets`, `favicon.png`, etc. **Don't use these as slugs**: `assets`, `api`, `static`, `css`, `js`, `about`, `contact`, `index`, `posts`, `favicon`. Any other lowercase-hyphenated name is fair game.

## Post fields

| Field    | Required | Notes |
|----------|----------|-------|
| `slug`   | yes      | Folder name in root. Lowercase, hyphenated. |
| `date`   | yes      | ISO `YYYY-MM-DD`. Newest first. |
| `scale`  | no       | Default `0.4`. Lower = preview shows more of the page (zoomed out). |
| `preview`| no       | Filename inside `<slug>/` to use as the card preview (e.g. `"preview.html"`). |
| `span`   | no       | Break the grid: `"2cols"`, `"2rows"`, or `"2x2"`. |
| `aspect` | no       | Override the square. `1` = square, `1.5` = portrait, `0.6` = wide. |

## Tech

Vanilla HTML + CSS + ES modules. No build step, no framework. `IntersectionObserver` for lazy-loading iframes. Hosted on GitHub Pages with custom domain via DNS.

## License

MIT — see [LICENSE](LICENSE).
