// limbrow.zip — netart archive
// =============================
//
// Each post is a folder under /<slug>/ with its own index.html.
// To add a new post:
//   1. Create /<slug>/index.html (or any structure inside)
//   2. Add an entry below
//   3. git add . && git commit -m "add <slug>" && git push
//
// Fields:
//   slug    (required) folder name in the root, lowercase-hyphenated.
//   date    (required) YYYY-MM-DD, newest first.
//   scale   (optional) iframe zoom-out factor in preview. 0.4 = default, lower = sees more.
//   preview (optional) filename inside /<slug>/ to use as the card preview (e.g. "preview.html").
//                      If omitted, the card shows the post's index.html itself.
//                      Use a dedicated preview for posts that look better cropped or animated alone.
//   href    (optional) where the card links when the piece lives on another host
//                      (e.g. "https://arte.zip"). The folder then only holds the preview.
//   span    (optional) break the grid: "2cols" | "2rows" | "2x2"
//   aspect  (optional) override the square. 1 = square (default), 1.5 = portrait, 0.6 = wide.
//                      Only use this when really needed — uniformity is a feature.
//
// Tip: posts at the very top of the array (newest dates) catch the most attention.
// If you make a "hero" post, give it `span: "2x2"` and put it first.

export const posts = [

    {
        slug: 'arte',
        date: '2026-09-14',
        preview: 'preview.html',  // the arte.zip piece — seven plates turning, light outside, dark centre
        href: 'https://arte.zip',
        scale: 1.0
    },

    {
        slug: 'whitehole',
        date: '2026-08-24',
        preview: 'preview.html',  // time-reversed schwarzschild — the shadow develops into light
        scale: 1.0
    },

    {
        slug: 'singularity',
        date: '2026-05-17',
        preview: 'preview.html',  // schwarzschild black hole, real per-pixel geodesic lensing
        scale: 1.0
    },

    {
        slug: 'liserium',
        date: '2026-04-15',
        preview: 'preview.html',  // LCD + sequencer crop, native 1:1
        scale: 1.0
    },

    {
        slug: 'game-of-life',
        date: '2026-04-10',
        preview: 'preview.html',  // live cellular automaton, auto-reseeds
        scale: 1.0                // preview fills the card, no zoom-out needed
    },

];
