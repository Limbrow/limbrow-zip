// limbrow.zip — post registry
//
// Each post is a folder under /p/<slug>/ with its own index.html
// Add a new post by:
//   1. Creating /p/<slug>/index.html (or any structure inside)
//   2. Adding an entry below
//   3. git add . && git commit -m "add <slug>" && git push
//
// Fields:
//   slug    (required) folder name under /p/
//   date    (required) YYYY-MM-DD, used for sort order (newest first)
//   aspect  (optional) preview height / width ratio. 1 = square, 1.5 = portrait, 0.6 = wide. Default 1
//   scale   (optional) iframe zoom-out factor. Lower = sees more of the page. Default 0.4

export const posts = [

    {
        slug: 'liserium',
        date: '2026-04-15',
        aspect: 1.4,
        scale: 0.4
    },

    {
        slug: 'game-of-life',
        date: '2026-04-10',
        aspect: 0.7,
        scale: 0.45
    },

];
