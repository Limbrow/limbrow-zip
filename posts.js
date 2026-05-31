// limbrow.zip — netart archive
// =============================
//
// Each post is a folder under /p/<slug>/ with its own index.html.
// To add a new post:
//   1. Create /p/<slug>/index.html (or any structure inside)
//   2. Add an entry below
//   3. git add . && git commit -m "add <slug>" && git push
//
// Fields:
//   slug    (required) folder name under /p/, lowercase-hyphenated.
//   date    (required) YYYY-MM-DD, newest first.
//   scale   (optional) iframe zoom-out factor in preview. 0.4 = default, lower = sees more.
//   preview (optional) filename inside /p/<slug>/ to use as the card preview (e.g. "preview.html").
//                      If omitted, the card shows the post's index.html itself.
//                      Use a dedicated preview for posts that look better cropped or animated alone.
//   span    (optional) break the grid: "2cols" | "2rows" | "2x2"
//   aspect  (optional) override the square. 1 = square (default), 1.5 = portrait, 0.6 = wide.
//                      Only use this when really needed — uniformity is a feature.
//
// Tip: posts at the very top of the array (newest dates) catch the most attention.
// If you make a "hero" post, give it `span: "2x2"` and put it first.

export const posts = [

    {
        slug: 'moire',
        date: '2026-05-17',
        preview: 'preview.html',  // moiré editor — layered line/ring/radial/spiral patterns
        scale: 1.0
    },

    {
        slug: 'physarum',
        date: '2026-05-17',
        preview: 'preview.html',  // competing slime-mould colonies — feed it with the cursor
        scale: 1.0
    },

    {
        slug: 'leparc',
        date: '2026-05-17',
        preview: 'preview.html',  // modulation grid of rotating lines — in memory of julio le parc
        scale: 1.0
    },

    {
        slug: 'blocks',
        date: '2026-05-17',
        preview: 'preview.html',  // flat-color rectangles, pixel-wipe transitions in 8 directions
        scale: 1.0
    },

    {
        slug: 'melt',
        date: '2026-05-17',
        preview: 'preview.html',  // pixel-sorted glitch, auto-cycling through modes
        scale: 1.0
    },

    {
        slug: 'loops',
        date: '2026-05-17',
        preview: 'preview.html',  // grid of Lissajous patterns auto-cycling through modes
        scale: 1.0
    },

    {
        slug: 'chukovski',
        date: '2026-05-16',
        preview: 'preview.html',  // breathing crop of the Repin painting
        scale: 1.0
    },

    {
        slug: 'guess',
        date: '2026-05-15',
        preview: 'preview.html',  // looping opening — "Hola!"
        scale: 1.0
    },

    {
        slug: 'aviary',
        date: '2026-05-14',
        preview: 'preview.html',  // animated sky + flock auto-singing
        scale: 1.0
    },

    {
        slug: 'ring',
        date: '2026-05-14',
        preview: 'preview.html',  // silent orbital ring with cloud sky
        scale: 1.0
    },

    {
        slug: 'fractals',
        date: '2026-05-13',
        preview: 'preview.html',  // auto-zooming Mandelbrot — a deep dive on loop
        scale: 1.0                // fullscreen card, no zoom-out
    },

    {
        slug: 'house-of-axes',
        date: '2026-05-11',
        preview: 'preview.html',  // dedicated card preview — just the animated graph
        scale: 0.55               // less zoom-out, the graph fills the card better
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
