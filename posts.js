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
        slug: 'house-of-axes',
        date: '2026-05-12',
        preview: 'preview.html',  // dedicated card preview — just the animated graph
        scale: 0.55               // less zoom-out, the graph fills the card better
    },

    {
        slug: 'liserium',
        date: '2026-04-15',
        scale: 0.35
    },

    {
        slug: 'game-of-life',
        date: '2026-04-10',
        scale: 0.45
    },

];
