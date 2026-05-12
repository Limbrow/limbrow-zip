# slides-template

> Vertical Tinder-style post template. Use this as base for any post-as-gallery.

## How to use

```bash
# 1. Copy the template
cp -r p/_template-slides p/<your-post-slug>

# 2. Drop your images in p/<your-post-slug>/assets/
#    Name them 01.webp, 02.webp, etc. (or rename in the HTML)

# 3. Open p/<your-post-slug>/index.html and:
#    - keep, add, or remove <section class="slide"> blocks
#    - each slide can be an <img>, <video>, <canvas>, <iframe>, or free HTML

# 4. Add an entry in posts.js:
#    {
#        slug: 'your-post-slug',
#        date: '2026-05-12',
#        preview: 'preview.html',   // optional, see below
#        scale: 0.4
#    }
```

## Slide types

The container imposes no aesthetic. Inside each `.slide` you can put:

| What                          | Example |
|-------------------------------|---------|
| **Image (contained)**         | `<section class="slide"><img src="assets/01.webp"></section>` |
| **Image (bleed/cover edge)**  | `<section class="slide bleed"><img src="assets/01.webp"></section>` |
| **Video loop**                | `<section class="slide bleed"><video src="assets/loop.mp4" autoplay loop muted playsinline></video></section>` |
| **Inline canvas sketch**      | `<section class="slide"><canvas id="..."></canvas><script>...</script></section>` |
| **Isolated sketch (iframe)**  | `<section class="slide"><iframe src="sketches/x.html"></iframe></section>` |
| **Plain text**                | `<section class="slide text"><p>your text</p></section>` |

## Navigation

- **Swipe up / scroll down** → next slide
- **Swipe down / scroll up** → previous slide
- **Arrow keys ↑ ↓ on desktop** (works out of the box thanks to scroll-snap)
- **Back arrow top-left** → returns to `limbrow.zip`

No autoplay. The user controls everything.

## Why this works

It uses **native CSS `scroll-snap-type: y mandatory`**. Zero JavaScript for navigation. Works on every modern browser, no library, no bugs. iOS, Android, desktop — all the same.

## Preview for the grid card

If you want a different visual to appear in the `limbrow.zip` grid card, create a `preview.html` in the same folder and set `preview: 'preview.html'` in `posts.js`. The preview can be just a static image, an animation, or whatever feels right for a 1:1 card.

If you don't create a preview, the grid card will show the first slide of `index.html`.
