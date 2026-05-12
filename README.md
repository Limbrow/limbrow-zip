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
└── p/
    ├── liserium/
    │   ├── index.html
    │   └── sounds.js
    ├── game-of-life/
    │   └── index.html
    └── <new-post>/
        └── index.html
```

Each post is self-contained inside `/p/<slug>/`. The folder can hold any HTML/CSS/JS/assets it needs — everything stays local to that post.

## Adding a post

```bash
mkdir -p p/sketch-042
$EDITOR p/sketch-042/index.html

# Add to posts.js:
#   {
#       slug: 'sketch-042',
#       date: '2026-05-12',
#       scale: 0.4            // optional: how zoomed-out the preview is
#   }

git add p/sketch-042 posts.js
git commit -m "add sketch-042"
git push
```

## Post fields

| Field    | Required | Notes |
|----------|----------|-------|
| `slug`   | yes      | Folder name under `/p/`. Lowercase, hyphenated. |
| `date`   | yes      | ISO `YYYY-MM-DD`. Newest first. |
| `scale`  | no       | Default `0.4`. Lower = preview shows more of the page (zoomed out). |
| `span`   | no       | Break the grid: `"2cols"`, `"2rows"`, or `"2x2"`. Use sparingly — uniformity is a feature, breaking it is a statement. |
| `aspect` | no       | Override the square. `1` = square (default), `1.5` = portrait, `0.6` = wide. Only when really needed. |

## Tech

Vanilla HTML + CSS + ES modules. No build step, no framework. `IntersectionObserver` for lazy-loading iframes. Hosted on GitHub Pages with custom domain via DNS.

## License

MIT — see [LICENSE](LICENSE).
