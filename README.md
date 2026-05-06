# limbrow.zip

> Personal archive of creative experiments by [limbrow](https://limbrow.com).

A self-hosted feed where every post is a live HTML page — code, art, sketches, visualizers, anything. Each card in the gallery shows a real, interactive miniature of the project.

Live at **[limbrow.zip](https://limbrow.zip)**.

## How it works

```
limbrow.zip/
├── index.html              ← the gallery (grid of cards)
├── posts.js                ← registry of all posts
├── favicon.png
├── apple-touch-icon.png
└── p/                      ← every post lives here
    ├── liserium/
    │   └── index.html
    ├── game-of-life/
    │   └── index.html
    └── <new-post>/
        └── index.html
```

Each post is a folder under `/p/<slug>/` containing its own `index.html`. The post can include any assets it needs (CSS, JS, images) inside its own folder — everything stays self-contained.

The gallery (`index.html`) reads `posts.js` and renders one card per entry. Each card embeds the post's `index.html` as a live, scaled-down iframe that animates on hover.

## Adding a new post

```bash
# 1. Create the folder + html
mkdir -p p/sketch-042
$EDITOR p/sketch-042/index.html

# 2. Register it in posts.js
#    Add this entry to the `posts` array:
#    {
#        slug: 'sketch-042',
#        name: 'sketch-042',
#        desc: 'flow field study · p5.js',
#        date: '2026-05-12',
#        glyph: '≈'
#    }

# 3. Commit and push
git add p/sketch-042 posts.js
git commit -m "add sketch-042"
git push
```

Done. The new card appears at `limbrow.zip` and the post is reachable at `limbrow.zip/p/sketch-042/`.

## Post entry fields

| Field   | Required | Notes |
|---------|----------|-------|
| `slug`  | yes      | Folder name under `/p/`. Lowercase, hyphenated. |
| `name`  | yes      | Display name shown on the card. |
| `desc`  | yes      | One-line description shown under the name. |
| `date`  | yes      | ISO date `YYYY-MM-DD`. Used for sorting (newest first). |
| `glyph` | no       | Single character shown as fallback when iframe is loading. |
| `cover` | no       | Path to a static cover image, e.g. `/p/<slug>/cover.png`. If set, used instead of the glyph. |

## Tech

Vanilla HTML + CSS + a tiny ES module for the gallery. No build step, no framework. Hosted on GitHub Pages with a custom domain.

Each card uses an `<iframe>` with `loading="lazy"` and an `IntersectionObserver` so previews only load when scrolled near. On hover, the static placeholder fades out and the live iframe fades in. On touch devices (where there's no hover), iframes are always visible.

## License

MIT — see [LICENSE](LICENSE).
