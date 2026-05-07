# limbrow.zip

> Personal archive of creative experiments by [limbrow](https://limbrow.com).

A self-hosted feed where every post is a live HTML page — code, art, sketches, visualizers, anything. Each card in the gallery shows a real, interactive miniature of the project.

Live at **[limbrow.zip](https://limbrow.zip)**.

## How it works

```
limbrow.zip/
├── index.html        ← masonry gallery
├── posts.js          ← post registry
├── avatar.jpg        ← profile picture (tap to expand)
├── favicon.png
├── apple-touch-icon.png
└── p/                ← every post lives here as a folder
    ├── liserium/
    │   └── index.html
    ├── game-of-life/
    │   └── index.html
    └── <new-post>/
        └── index.html
```

## Adding a new post

```bash
mkdir -p p/sketch-042
$EDITOR p/sketch-042/index.html

# Add this entry to posts.js:
#   {
#       slug: 'sketch-042',
#       date: '2026-05-12',
#       aspect: 1,        // optional, default 1 (square). Higher = taller.
#       scale: 0.4        // optional, default 0.4. Lower = more zoomed out.
#   }

git add p/sketch-042 posts.js
git commit -m "add sketch-042"
git push
```

## Post fields

| Field    | Required | Notes |
|----------|----------|-------|
| `slug`   | yes      | Folder name under `/p/`. Lowercase, hyphenated. |
| `date`   | yes      | ISO `YYYY-MM-DD`. Sort order (newest first). |
| `aspect` | no       | Card height / width ratio. `1` = square (default), `1.4` = portrait, `0.7` = wide. |
| `scale`  | no       | Iframe zoom-out factor in preview. Default `0.4`. Lower = sees more of the page. |

## Tech

Vanilla HTML + CSS + a tiny ES module. CSS columns for the masonry layout. `IntersectionObserver` to lazy-load iframes only when scrolling near. No build step, no framework.

## License

MIT — see [LICENSE](LICENSE).
