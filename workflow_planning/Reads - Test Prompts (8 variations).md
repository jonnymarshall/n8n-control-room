# Read artwork prompt, locked (v5, four looks)

Status: **BUILT and LIVE 2026-10-22. First real Read ran 2026-10-23 (execution 8048).** Artwork `5c1f0dbe`,
assistant `570eef8c`, metadata `ad18ebd4`. The four looks, book cover pass, no-cover branch,
square reversion and revision prompts are all wired.

> **One change made during the build:** the `Image 2` sentence was moved out of `SUBJECT` and
> into the `Read Book Cover` row. In no-cover mode there is no Image 2, so the body must not
> promise one. The rendered blocks below still show the older body; the live template is the
> source of truth.

> **2026-10-28:** the live `Read Thumbnail` prompt row now takes `{{VIBE}}` in its `EXPRESSION` block, so a Read defaults to `Neutral` but can use any expression Jonny picks (first test: `Dramatic/Intense` on `BA-8YfSPH`). The expression wording shown in the rendered blocks below is the pre-2026-10-28 fixed smile; the Airtable row is the source of truth.

## The decision

Expression **V1** (closed-mouth, content) is locked. Both wordings passed, but V1 passed on
both shots, so it is the safer base.

The four generated options are now the **four looks you actually liked**, not four framings
of one room:

| Option | Look | Why |
|---|---|---|
| 1 | Study, looking at camera | A1-V1. Loved. |
| 2 | Study, looking at the book | A3-V1. Loved, best book proportions. |
| 3 | Nook, looking at camera | C1-V1. Liked, book needed shrinking. |
| 4 | Nook, looking at the book | C3-V1. Liked, it showed the back cover. |

So every run gives **two rooms x two poses**: two looking at the lens, two looking at the
book. Same predictable variety as a Chat or a Take, where the options differ in mood and
framing rather than being near-duplicates.

Three fixes from the round-2 failures apply to all four:

1. **Book scale.** A normal trade hardback, about 6 x 9 inches, cover roughly the width of
   his head and never wider, explicitly not a coffee-table book, art book, A4 folder or
   magazine. If the framing feels tight, pull the camera back rather than enlarging the book.
2. **Closed book.** No open pages, spread or fan of pages. The cover wraps only the front
   board, never the spine or back.
3. **Front cover orientation.** Spine on the left, and the image must show the front cover,
   never the back.

## Airtable rows

The template is shared; the pieces are separate rows so they can be tuned without a deploy:

| Row | Holds |
|---|---|
| `Read Thumbnail` | The body: subject, one-photograph, microphone, expression, colour, headline area, producer direction. Tokens `{{BOOK}}`, `{{SCENE}}`, `{{VIBE}}` (added 2026-10-28), `{{CUSTOM}}`. |
| `Read Book Cover` | The book rules when a cover is attached. |
| `Read Book No Cover` | The plain dark book block. |
| `Read Scene Study` | Study room and lighting. |
| `Read Scene Nook` | Reading nook and lighting. |

The **option mapping lives in code** (which shot goes with which scene, and the order), so the
four looks are fixed and predictable. The wording of every scene and book block is editable in
Airtable.

## What will run (with a cover attached)

Shot line first, then the body, ending with the output line.


### Option 1 - Study, looking at camera

The study, medium close-up, eyes on the lens.

```text
SHOT
LOOKING AT CAMERA. Medium close-up at eye level: the host faces the lens, holding the closed book up at chest height with the front cover square to the camera.

Create a 16:9 YouTube thumbnail photograph for a Bitcoin books-and-ideas show. The photograph fills the entire frame edge to edge: no letterboxing, no black bars, no borders, no bands, no solid strips.

SUBJECT
Image 1 is the host. Use it for LIKENESS ONLY: same face shape, hair, beard, eyes and skin tone. Do NOT copy the expression he happens to be wearing in Image 1. Follow the EXPRESSION block below exactly. Image 2 is the front cover artwork of the book. It must appear on the front of the book in the photograph, exactly as supplied.

ONE REAL PHOTOGRAPH (NON-NEGOTIABLE)
Build a single, believable photograph in one room, under one lighting setup, from one camera. The host, the book, the microphone and the furniture must share the same perspective, lighting direction, colour temperature and focus. Natural shadow and believable scale everywhere. Do not paste, cut out or superimpose the host. No cut-out edges, hard outlines or halos around the head, hair or clothing.

THE BOOK (NON-NEGOTIABLE)
It is a real hardback in a normal trade format, about 6 x 9 inches (15 x 23 cm), the size of an ordinary novel. Its cover is roughly the width of his head and NEVER wider: it is not a coffee-table book, an art book, an A4 folder or a magazine. If the framing feels tight, pull the camera back; never solve it by making the book larger. The book is CLOSED: no open pages, no spread, no fan of pages, only the closed page block visible along the fore-edge.
We see the FRONT cover, never the back. The front cover faces the camera SQUARE ON and is fully visible: all four edges of the cover inside the frame, unobstructed by fingers, hand, wrist, sleeve, hair, microphone or shadow. The spine is on the LEFT as we look at the book and the fore-edge on the right. If he is holding it, his hands hold only the outer edges of the boards. If it rests on the desk, nothing overlaps it. The cover is evenly lit so every detail reads.
Reproduce the supplied cover EXACTLY. Do not redraw, reinterpret, re-letter, translate, crop, recolour, restyle or clean up anything on it. Every word, number, logo and illustration must match Image 2. Image 2 is a flat artwork file, not a photograph of a room: do not paste it into the scene as a flat rectangle and do not show it as a screen, poster or inset. Wrap it onto the FRONT BOARD of the book with correct perspective, and only the front board: never the spine, never the back cover.
The cover may contain its own title and author text. That is the ONLY text allowed in the image, and it must be preserved exactly. Add no text of your own anywhere.

THE MICROPHONE
A professional large-diaphragm condenser microphone in shot, on a black boom arm with a shock mount and a pop filter, correctly scaled and lit like a real object in the room. It must not cross or obscure the book cover. No logos or brand names on it.

PEOPLE AND FRAMING
Show the host at least from the top of the head to the upper chest. Never crop the top of his head and never cut the face off at the chin or neck.

EXPRESSION (NON-NEGOTIABLE)
A slight, closed-mouth smile. The quiet, content expression of a man enjoying a good book: the corners of his mouth gently lifted, lips together, no teeth showing. His eyes are warm, alert and interested, engaged with the book or the lens, never blank, bored, glazed or flat. He looks absorbed rather than amused. No broad grin, no laughter, no open mouth, no raised eyebrows, no exaggerated surprise, no stiff passport stare. Do not default to the flat expression of the reference photo.

COLOUR - NON-NEGOTIABLE
Render the host in full, natural colour: lifelike skin tones and the true colour of his hair, beard, eyes and clothing exactly as in Image 1. Never render a person greyscale, monochrome, sepia, duotone, desaturated or as a flat colour-tinted cut-out, and never drain colour out of a face to help it blend into the background. The room MAY be dark and muted; the person must not be.

MANUAL HEADLINE AREA
Do not render any headline. Reserve ONE naturally dark, low-detail area of the room for a headline to be added later in Photoshop, at the top or bottom of the image, never left or right. It must be wide enough for one short line of large text, and it must read as part of the room: deep shadow, blurred background or empty darkness. Keep it clear of the face, the book cover and the microphone. ABSOLUTELY NO full-width black bar, black band, letterbox bar, hard-edged strip, banner, box, panel, rectangle, border or split caption area, and never add a graphic overlay. The photograph itself must reach every edge of the frame. If there is no natural place for the area, leave the background intact.

OPTIONAL PRODUCER DIRECTION
This may refine the room, props, wardrobe or lighting mood. It must NOT override the book rules, the expression, the framing or the no-text rule.


SCENE
A controlled, studio-lit study set at night. Deep charcoal panelling, a worn leather wing chair, shelves of hardback books falling softly out of focus behind him, a brass reading lamp just off camera throwing a warm pool of light across him and the book. A low side table with a glass of water and reading glasses. The room continues to every edge of the frame: no wall, cloth or backdrop ends inside the picture. Dark, quiet, expensive, deliberately lit.

LIGHTING
Cinematic three-point studio lighting: a soft key from camera left, a subtle rim light separating his hair and shoulders from the background, and a dim warm practical lamp behind him. Even, clean light across the book cover so every detail of it reads. No flare, no hot spots, no light falling across the cover.

Output a single 16:9 image. The fill-the-frame rule, ONE REAL PHOTOGRAPH, THE BOOK, EXPRESSION, PEOPLE AND FRAMING and the cover-text rule above always apply.
```


### Option 2 - Study, looking at the book

The study, book held, eyes down. Best book proportions in testing.

```text
SHOT
LOOKING AT THE BOOK. Medium shot: the host holds the closed book in both hands at chest height, the front cover turned square to the camera and fully visible, his head tilted down and his eyes on the cover. His fingers grip only the outer edges of the boards. We see the front cover, not the back. He is not looking at the lens.

Create a 16:9 YouTube thumbnail photograph for a Bitcoin books-and-ideas show. The photograph fills the entire frame edge to edge: no letterboxing, no black bars, no borders, no bands, no solid strips.

SUBJECT
Image 1 is the host. Use it for LIKENESS ONLY: same face shape, hair, beard, eyes and skin tone. Do NOT copy the expression he happens to be wearing in Image 1. Follow the EXPRESSION block below exactly. Image 2 is the front cover artwork of the book. It must appear on the front of the book in the photograph, exactly as supplied.

ONE REAL PHOTOGRAPH (NON-NEGOTIABLE)
Build a single, believable photograph in one room, under one lighting setup, from one camera. The host, the book, the microphone and the furniture must share the same perspective, lighting direction, colour temperature and focus. Natural shadow and believable scale everywhere. Do not paste, cut out or superimpose the host. No cut-out edges, hard outlines or halos around the head, hair or clothing.

THE BOOK (NON-NEGOTIABLE)
It is a real hardback in a normal trade format, about 6 x 9 inches (15 x 23 cm), the size of an ordinary novel. Its cover is roughly the width of his head and NEVER wider: it is not a coffee-table book, an art book, an A4 folder or a magazine. If the framing feels tight, pull the camera back; never solve it by making the book larger. The book is CLOSED: no open pages, no spread, no fan of pages, only the closed page block visible along the fore-edge.
We see the FRONT cover, never the back. The front cover faces the camera SQUARE ON and is fully visible: all four edges of the cover inside the frame, unobstructed by fingers, hand, wrist, sleeve, hair, microphone or shadow. The spine is on the LEFT as we look at the book and the fore-edge on the right. If he is holding it, his hands hold only the outer edges of the boards. If it rests on the desk, nothing overlaps it. The cover is evenly lit so every detail reads.
Reproduce the supplied cover EXACTLY. Do not redraw, reinterpret, re-letter, translate, crop, recolour, restyle or clean up anything on it. Every word, number, logo and illustration must match Image 2. Image 2 is a flat artwork file, not a photograph of a room: do not paste it into the scene as a flat rectangle and do not show it as a screen, poster or inset. Wrap it onto the FRONT BOARD of the book with correct perspective, and only the front board: never the spine, never the back cover.
The cover may contain its own title and author text. That is the ONLY text allowed in the image, and it must be preserved exactly. Add no text of your own anywhere.

THE MICROPHONE
A professional large-diaphragm condenser microphone in shot, on a black boom arm with a shock mount and a pop filter, correctly scaled and lit like a real object in the room. It must not cross or obscure the book cover. No logos or brand names on it.

PEOPLE AND FRAMING
Show the host at least from the top of the head to the upper chest. Never crop the top of his head and never cut the face off at the chin or neck.

EXPRESSION (NON-NEGOTIABLE)
A slight, closed-mouth smile. The quiet, content expression of a man enjoying a good book: the corners of his mouth gently lifted, lips together, no teeth showing. His eyes are warm, alert and interested, engaged with the book or the lens, never blank, bored, glazed or flat. He looks absorbed rather than amused. No broad grin, no laughter, no open mouth, no raised eyebrows, no exaggerated surprise, no stiff passport stare. Do not default to the flat expression of the reference photo.

COLOUR - NON-NEGOTIABLE
Render the host in full, natural colour: lifelike skin tones and the true colour of his hair, beard, eyes and clothing exactly as in Image 1. Never render a person greyscale, monochrome, sepia, duotone, desaturated or as a flat colour-tinted cut-out, and never drain colour out of a face to help it blend into the background. The room MAY be dark and muted; the person must not be.

MANUAL HEADLINE AREA
Do not render any headline. Reserve ONE naturally dark, low-detail area of the room for a headline to be added later in Photoshop, at the top or bottom of the image, never left or right. It must be wide enough for one short line of large text, and it must read as part of the room: deep shadow, blurred background or empty darkness. Keep it clear of the face, the book cover and the microphone. ABSOLUTELY NO full-width black bar, black band, letterbox bar, hard-edged strip, banner, box, panel, rectangle, border or split caption area, and never add a graphic overlay. The photograph itself must reach every edge of the frame. If there is no natural place for the area, leave the background intact.

OPTIONAL PRODUCER DIRECTION
This may refine the room, props, wardrobe or lighting mood. It must NOT override the book rules, the expression, the framing or the no-text rule.


SCENE
A controlled, studio-lit study set at night. Deep charcoal panelling, a worn leather wing chair, shelves of hardback books falling softly out of focus behind him, a brass reading lamp just off camera throwing a warm pool of light across him and the book. A low side table with a glass of water and reading glasses. The room continues to every edge of the frame: no wall, cloth or backdrop ends inside the picture. Dark, quiet, expensive, deliberately lit.

LIGHTING
Cinematic three-point studio lighting: a soft key from camera left, a subtle rim light separating his hair and shoulders from the background, and a dim warm practical lamp behind him. Even, clean light across the book cover so every detail of it reads. No flare, no hot spots, no light falling across the cover.

Output a single 16:9 image. The fill-the-frame rule, ONE REAL PHOTOGRAPH, THE BOOK, EXPRESSION, PEOPLE AND FRAMING and the cover-text rule above always apply.
```


### Option 3 - Nook, looking at camera

The reading nook, medium close-up, eyes on the lens.

```text
SHOT
LOOKING AT CAMERA. Medium close-up at eye level: the host faces the lens, holding the closed book up at chest height with the front cover square to the camera.

Create a 16:9 YouTube thumbnail photograph for a Bitcoin books-and-ideas show. The photograph fills the entire frame edge to edge: no letterboxing, no black bars, no borders, no bands, no solid strips.

SUBJECT
Image 1 is the host. Use it for LIKENESS ONLY: same face shape, hair, beard, eyes and skin tone. Do NOT copy the expression he happens to be wearing in Image 1. Follow the EXPRESSION block below exactly. Image 2 is the front cover artwork of the book. It must appear on the front of the book in the photograph, exactly as supplied.

ONE REAL PHOTOGRAPH (NON-NEGOTIABLE)
Build a single, believable photograph in one room, under one lighting setup, from one camera. The host, the book, the microphone and the furniture must share the same perspective, lighting direction, colour temperature and focus. Natural shadow and believable scale everywhere. Do not paste, cut out or superimpose the host. No cut-out edges, hard outlines or halos around the head, hair or clothing.

THE BOOK (NON-NEGOTIABLE)
It is a real hardback in a normal trade format, about 6 x 9 inches (15 x 23 cm), the size of an ordinary novel. Its cover is roughly the width of his head and NEVER wider: it is not a coffee-table book, an art book, an A4 folder or a magazine. If the framing feels tight, pull the camera back; never solve it by making the book larger. The book is CLOSED: no open pages, no spread, no fan of pages, only the closed page block visible along the fore-edge.
We see the FRONT cover, never the back. The front cover faces the camera SQUARE ON and is fully visible: all four edges of the cover inside the frame, unobstructed by fingers, hand, wrist, sleeve, hair, microphone or shadow. The spine is on the LEFT as we look at the book and the fore-edge on the right. If he is holding it, his hands hold only the outer edges of the boards. If it rests on the desk, nothing overlaps it. The cover is evenly lit so every detail reads.
Reproduce the supplied cover EXACTLY. Do not redraw, reinterpret, re-letter, translate, crop, recolour, restyle or clean up anything on it. Every word, number, logo and illustration must match Image 2. Image 2 is a flat artwork file, not a photograph of a room: do not paste it into the scene as a flat rectangle and do not show it as a screen, poster or inset. Wrap it onto the FRONT BOARD of the book with correct perspective, and only the front board: never the spine, never the back cover.
The cover may contain its own title and author text. That is the ONLY text allowed in the image, and it must be preserved exactly. Add no text of your own anywhere.

THE MICROPHONE
A professional large-diaphragm condenser microphone in shot, on a black boom arm with a shock mount and a pop filter, correctly scaled and lit like a real object in the room. It must not cross or obscure the book cover. No logos or brand names on it.

PEOPLE AND FRAMING
Show the host at least from the top of the head to the upper chest. Never crop the top of his head and never cut the face off at the chin or neck.

EXPRESSION (NON-NEGOTIABLE)
A slight, closed-mouth smile. The quiet, content expression of a man enjoying a good book: the corners of his mouth gently lifted, lips together, no teeth showing. His eyes are warm, alert and interested, engaged with the book or the lens, never blank, bored, glazed or flat. He looks absorbed rather than amused. No broad grin, no laughter, no open mouth, no raised eyebrows, no exaggerated surprise, no stiff passport stare. Do not default to the flat expression of the reference photo.

COLOUR - NON-NEGOTIABLE
Render the host in full, natural colour: lifelike skin tones and the true colour of his hair, beard, eyes and clothing exactly as in Image 1. Never render a person greyscale, monochrome, sepia, duotone, desaturated or as a flat colour-tinted cut-out, and never drain colour out of a face to help it blend into the background. The room MAY be dark and muted; the person must not be.

MANUAL HEADLINE AREA
Do not render any headline. Reserve ONE naturally dark, low-detail area of the room for a headline to be added later in Photoshop, at the top or bottom of the image, never left or right. It must be wide enough for one short line of large text, and it must read as part of the room: deep shadow, blurred background or empty darkness. Keep it clear of the face, the book cover and the microphone. ABSOLUTELY NO full-width black bar, black band, letterbox bar, hard-edged strip, banner, box, panel, rectangle, border or split caption area, and never add a graphic overlay. The photograph itself must reach every edge of the frame. If there is no natural place for the area, leave the background intact.

OPTIONAL PRODUCER DIRECTION
This may refine the room, props, wardrobe or lighting mood. It must NOT override the book rules, the expression, the framing or the no-text rule.


SCENE
A controlled, studio-lit reading nook at night. A deep green wall, a low charcoal armchair, a stack of three hardbacks on the floor, the rest of the room falling into soft shadow. The background is heavily out of focus but continuous to every edge of the frame. Intimate, still, close.

LIGHTING
Cinematic three-point studio lighting: a soft key from camera left, a subtle rim light on his hair and shoulders, and a single warm lamp just out of frame. Even, clean light across the book cover so every detail of it reads. No flare, no hot spots, no light falling across the cover.

Output a single 16:9 image. The fill-the-frame rule, ONE REAL PHOTOGRAPH, THE BOOK, EXPRESSION, PEOPLE AND FRAMING and the cover-text rule above always apply.
```


### Option 4 - Nook, looking at the book

The reading nook, book held, eyes down.

```text
SHOT
LOOKING AT THE BOOK. Medium shot: the host holds the closed book in both hands at chest height, the front cover turned square to the camera and fully visible, his head tilted down and his eyes on the cover. His fingers grip only the outer edges of the boards. We see the front cover, not the back. He is not looking at the lens.

Create a 16:9 YouTube thumbnail photograph for a Bitcoin books-and-ideas show. The photograph fills the entire frame edge to edge: no letterboxing, no black bars, no borders, no bands, no solid strips.

SUBJECT
Image 1 is the host. Use it for LIKENESS ONLY: same face shape, hair, beard, eyes and skin tone. Do NOT copy the expression he happens to be wearing in Image 1. Follow the EXPRESSION block below exactly. Image 2 is the front cover artwork of the book. It must appear on the front of the book in the photograph, exactly as supplied.

ONE REAL PHOTOGRAPH (NON-NEGOTIABLE)
Build a single, believable photograph in one room, under one lighting setup, from one camera. The host, the book, the microphone and the furniture must share the same perspective, lighting direction, colour temperature and focus. Natural shadow and believable scale everywhere. Do not paste, cut out or superimpose the host. No cut-out edges, hard outlines or halos around the head, hair or clothing.

THE BOOK (NON-NEGOTIABLE)
It is a real hardback in a normal trade format, about 6 x 9 inches (15 x 23 cm), the size of an ordinary novel. Its cover is roughly the width of his head and NEVER wider: it is not a coffee-table book, an art book, an A4 folder or a magazine. If the framing feels tight, pull the camera back; never solve it by making the book larger. The book is CLOSED: no open pages, no spread, no fan of pages, only the closed page block visible along the fore-edge.
We see the FRONT cover, never the back. The front cover faces the camera SQUARE ON and is fully visible: all four edges of the cover inside the frame, unobstructed by fingers, hand, wrist, sleeve, hair, microphone or shadow. The spine is on the LEFT as we look at the book and the fore-edge on the right. If he is holding it, his hands hold only the outer edges of the boards. If it rests on the desk, nothing overlaps it. The cover is evenly lit so every detail reads.
Reproduce the supplied cover EXACTLY. Do not redraw, reinterpret, re-letter, translate, crop, recolour, restyle or clean up anything on it. Every word, number, logo and illustration must match Image 2. Image 2 is a flat artwork file, not a photograph of a room: do not paste it into the scene as a flat rectangle and do not show it as a screen, poster or inset. Wrap it onto the FRONT BOARD of the book with correct perspective, and only the front board: never the spine, never the back cover.
The cover may contain its own title and author text. That is the ONLY text allowed in the image, and it must be preserved exactly. Add no text of your own anywhere.

THE MICROPHONE
A professional large-diaphragm condenser microphone in shot, on a black boom arm with a shock mount and a pop filter, correctly scaled and lit like a real object in the room. It must not cross or obscure the book cover. No logos or brand names on it.

PEOPLE AND FRAMING
Show the host at least from the top of the head to the upper chest. Never crop the top of his head and never cut the face off at the chin or neck.

EXPRESSION (NON-NEGOTIABLE)
A slight, closed-mouth smile. The quiet, content expression of a man enjoying a good book: the corners of his mouth gently lifted, lips together, no teeth showing. His eyes are warm, alert and interested, engaged with the book or the lens, never blank, bored, glazed or flat. He looks absorbed rather than amused. No broad grin, no laughter, no open mouth, no raised eyebrows, no exaggerated surprise, no stiff passport stare. Do not default to the flat expression of the reference photo.

COLOUR - NON-NEGOTIABLE
Render the host in full, natural colour: lifelike skin tones and the true colour of his hair, beard, eyes and clothing exactly as in Image 1. Never render a person greyscale, monochrome, sepia, duotone, desaturated or as a flat colour-tinted cut-out, and never drain colour out of a face to help it blend into the background. The room MAY be dark and muted; the person must not be.

MANUAL HEADLINE AREA
Do not render any headline. Reserve ONE naturally dark, low-detail area of the room for a headline to be added later in Photoshop, at the top or bottom of the image, never left or right. It must be wide enough for one short line of large text, and it must read as part of the room: deep shadow, blurred background or empty darkness. Keep it clear of the face, the book cover and the microphone. ABSOLUTELY NO full-width black bar, black band, letterbox bar, hard-edged strip, banner, box, panel, rectangle, border or split caption area, and never add a graphic overlay. The photograph itself must reach every edge of the frame. If there is no natural place for the area, leave the background intact.

OPTIONAL PRODUCER DIRECTION
This may refine the room, props, wardrobe or lighting mood. It must NOT override the book rules, the expression, the framing or the no-text rule.


SCENE
A controlled, studio-lit reading nook at night. A deep green wall, a low charcoal armchair, a stack of three hardbacks on the floor, the rest of the room falling into soft shadow. The background is heavily out of focus but continuous to every edge of the frame. Intimate, still, close.

LIGHTING
Cinematic three-point studio lighting: a soft key from camera left, a subtle rim light on his hair and shoulders, and a single warm lamp just out of frame. Even, clean light across the book cover so every detail of it reads. No flare, no hot spots, no light falling across the cover.

Output a single 16:9 image. The fill-the-frame rule, ONE REAL PHOTOGRAPH, THE BOOK, EXPRESSION, PEOPLE AND FRAMING and the cover-text rule above always apply.
```


## No-cover mode (no `Book Cover` attached)

Same body and scenes, the plain-book block, and four looks that do not need a cover:


### No-cover option 1 - Study, looking at camera

The study, medium close-up, eyes on the lens.

```text
SHOT
LOOKING AT CAMERA. Medium close-up at eye level: the host faces the lens, holding the closed plain book up at chest height.

Create a 16:9 YouTube thumbnail photograph for a Bitcoin books-and-ideas show. The photograph fills the entire frame edge to edge: no letterboxing, no black bars, no borders, no bands, no solid strips.

SUBJECT
Image 1 is the host. Use it for LIKENESS ONLY: same face shape, hair, beard, eyes and skin tone. Do NOT copy the expression he happens to be wearing in Image 1. Follow the EXPRESSION block below exactly. Image 2 is the front cover artwork of the book. It must appear on the front of the book in the photograph, exactly as supplied.

ONE REAL PHOTOGRAPH (NON-NEGOTIABLE)
Build a single, believable photograph in one room, under one lighting setup, from one camera. The host, the book, the microphone and the furniture must share the same perspective, lighting direction, colour temperature and focus. Natural shadow and believable scale everywhere. Do not paste, cut out or superimpose the host. No cut-out edges, hard outlines or halos around the head, hair or clothing.

THE BOOK (NON-NEGOTIABLE)
It is a real hardback in a normal trade format, about 6 x 9 inches (15 x 23 cm), the size of an ordinary novel. It has a plain, dark, unprinted cover: no title, no author, no artwork, no logo and no lettering anywhere, on the front, spine or back. It is a physical object in his hands or on the desk, lit like everything else in the room, and it must read as an ordinary book, never oversized.

THE MICROPHONE
A professional large-diaphragm condenser microphone in shot, on a black boom arm with a shock mount and a pop filter, correctly scaled and lit like a real object in the room. It must not cross or obscure the book cover. No logos or brand names on it.

PEOPLE AND FRAMING
Show the host at least from the top of the head to the upper chest. Never crop the top of his head and never cut the face off at the chin or neck.

EXPRESSION (NON-NEGOTIABLE)
A slight, closed-mouth smile. The quiet, content expression of a man enjoying a good book: the corners of his mouth gently lifted, lips together, no teeth showing. His eyes are warm, alert and interested, engaged with the book or the lens, never blank, bored, glazed or flat. He looks absorbed rather than amused. No broad grin, no laughter, no open mouth, no raised eyebrows, no exaggerated surprise, no stiff passport stare. Do not default to the flat expression of the reference photo.

COLOUR - NON-NEGOTIABLE
Render the host in full, natural colour: lifelike skin tones and the true colour of his hair, beard, eyes and clothing exactly as in Image 1. Never render a person greyscale, monochrome, sepia, duotone, desaturated or as a flat colour-tinted cut-out, and never drain colour out of a face to help it blend into the background. The room MAY be dark and muted; the person must not be.

MANUAL HEADLINE AREA
Do not render any headline. Reserve ONE naturally dark, low-detail area of the room for a headline to be added later in Photoshop, at the top or bottom of the image, never left or right. It must be wide enough for one short line of large text, and it must read as part of the room: deep shadow, blurred background or empty darkness. Keep it clear of the face, the book cover and the microphone. ABSOLUTELY NO full-width black bar, black band, letterbox bar, hard-edged strip, banner, box, panel, rectangle, border or split caption area, and never add a graphic overlay. The photograph itself must reach every edge of the frame. If there is no natural place for the area, leave the background intact.

OPTIONAL PRODUCER DIRECTION
This may refine the room, props, wardrobe or lighting mood. It must NOT override the book rules, the expression, the framing or the no-text rule.


SCENE
A controlled, studio-lit study set at night. Deep charcoal panelling, a worn leather wing chair, shelves of hardback books falling softly out of focus behind him, a brass reading lamp just off camera throwing a warm pool of light across him and the book. A low side table with a glass of water and reading glasses. The room continues to every edge of the frame: no wall, cloth or backdrop ends inside the picture. Dark, quiet, expensive, deliberately lit.

LIGHTING
Cinematic three-point studio lighting: a soft key from camera left, a subtle rim light separating his hair and shoulders from the background, and a dim warm practical lamp behind him. Even, clean light across the book cover so every detail of it reads. No flare, no hot spots, no light falling across the cover.

Output a single 16:9 image. The fill-the-frame rule, ONE REAL PHOTOGRAPH, THE BOOK, EXPRESSION, PEOPLE AND FRAMING and the cover-text rule above always apply.
```


### No-cover option 2 - Study, reading

The study, book open, held, eyes on the pages.

```text
SHOT
READING. Medium close-up at eye level: the host holds the book open in both hands at chest height, looking down at the pages. The outside of the book faces the camera.

Create a 16:9 YouTube thumbnail photograph for a Bitcoin books-and-ideas show. The photograph fills the entire frame edge to edge: no letterboxing, no black bars, no borders, no bands, no solid strips.

SUBJECT
Image 1 is the host. Use it for LIKENESS ONLY: same face shape, hair, beard, eyes and skin tone. Do NOT copy the expression he happens to be wearing in Image 1. Follow the EXPRESSION block below exactly. Image 2 is the front cover artwork of the book. It must appear on the front of the book in the photograph, exactly as supplied.

ONE REAL PHOTOGRAPH (NON-NEGOTIABLE)
Build a single, believable photograph in one room, under one lighting setup, from one camera. The host, the book, the microphone and the furniture must share the same perspective, lighting direction, colour temperature and focus. Natural shadow and believable scale everywhere. Do not paste, cut out or superimpose the host. No cut-out edges, hard outlines or halos around the head, hair or clothing.

THE BOOK (NON-NEGOTIABLE)
It is a real hardback in a normal trade format, about 6 x 9 inches (15 x 23 cm), the size of an ordinary novel. It has a plain, dark, unprinted cover: no title, no author, no artwork, no logo and no lettering anywhere, on the front, spine or back. It is a physical object in his hands or on the desk, lit like everything else in the room, and it must read as an ordinary book, never oversized.

THE MICROPHONE
A professional large-diaphragm condenser microphone in shot, on a black boom arm with a shock mount and a pop filter, correctly scaled and lit like a real object in the room. It must not cross or obscure the book cover. No logos or brand names on it.

PEOPLE AND FRAMING
Show the host at least from the top of the head to the upper chest. Never crop the top of his head and never cut the face off at the chin or neck.

EXPRESSION (NON-NEGOTIABLE)
A slight, closed-mouth smile. The quiet, content expression of a man enjoying a good book: the corners of his mouth gently lifted, lips together, no teeth showing. His eyes are warm, alert and interested, engaged with the book or the lens, never blank, bored, glazed or flat. He looks absorbed rather than amused. No broad grin, no laughter, no open mouth, no raised eyebrows, no exaggerated surprise, no stiff passport stare. Do not default to the flat expression of the reference photo.

COLOUR - NON-NEGOTIABLE
Render the host in full, natural colour: lifelike skin tones and the true colour of his hair, beard, eyes and clothing exactly as in Image 1. Never render a person greyscale, monochrome, sepia, duotone, desaturated or as a flat colour-tinted cut-out, and never drain colour out of a face to help it blend into the background. The room MAY be dark and muted; the person must not be.

MANUAL HEADLINE AREA
Do not render any headline. Reserve ONE naturally dark, low-detail area of the room for a headline to be added later in Photoshop, at the top or bottom of the image, never left or right. It must be wide enough for one short line of large text, and it must read as part of the room: deep shadow, blurred background or empty darkness. Keep it clear of the face, the book cover and the microphone. ABSOLUTELY NO full-width black bar, black band, letterbox bar, hard-edged strip, banner, box, panel, rectangle, border or split caption area, and never add a graphic overlay. The photograph itself must reach every edge of the frame. If there is no natural place for the area, leave the background intact.

OPTIONAL PRODUCER DIRECTION
This may refine the room, props, wardrobe or lighting mood. It must NOT override the book rules, the expression, the framing or the no-text rule.


SCENE
A controlled, studio-lit study set at night. Deep charcoal panelling, a worn leather wing chair, shelves of hardback books falling softly out of focus behind him, a brass reading lamp just off camera throwing a warm pool of light across him and the book. A low side table with a glass of water and reading glasses. The room continues to every edge of the frame: no wall, cloth or backdrop ends inside the picture. Dark, quiet, expensive, deliberately lit.

LIGHTING
Cinematic three-point studio lighting: a soft key from camera left, a subtle rim light separating his hair and shoulders from the background, and a dim warm practical lamp behind him. Even, clean light across the book cover so every detail of it reads. No flare, no hot spots, no light falling across the cover.

Output a single 16:9 image. The fill-the-frame rule, ONE REAL PHOTOGRAPH, THE BOOK, EXPRESSION, PEOPLE AND FRAMING and the cover-text rule above always apply.
```


### No-cover option 3 - Nook, looking at camera

The reading nook, medium close-up, eyes on the lens.

```text
SHOT
LOOKING AT CAMERA. Medium close-up at eye level: the host faces the lens, holding the closed plain book up at chest height.

Create a 16:9 YouTube thumbnail photograph for a Bitcoin books-and-ideas show. The photograph fills the entire frame edge to edge: no letterboxing, no black bars, no borders, no bands, no solid strips.

SUBJECT
Image 1 is the host. Use it for LIKENESS ONLY: same face shape, hair, beard, eyes and skin tone. Do NOT copy the expression he happens to be wearing in Image 1. Follow the EXPRESSION block below exactly. Image 2 is the front cover artwork of the book. It must appear on the front of the book in the photograph, exactly as supplied.

ONE REAL PHOTOGRAPH (NON-NEGOTIABLE)
Build a single, believable photograph in one room, under one lighting setup, from one camera. The host, the book, the microphone and the furniture must share the same perspective, lighting direction, colour temperature and focus. Natural shadow and believable scale everywhere. Do not paste, cut out or superimpose the host. No cut-out edges, hard outlines or halos around the head, hair or clothing.

THE BOOK (NON-NEGOTIABLE)
It is a real hardback in a normal trade format, about 6 x 9 inches (15 x 23 cm), the size of an ordinary novel. It has a plain, dark, unprinted cover: no title, no author, no artwork, no logo and no lettering anywhere, on the front, spine or back. It is a physical object in his hands or on the desk, lit like everything else in the room, and it must read as an ordinary book, never oversized.

THE MICROPHONE
A professional large-diaphragm condenser microphone in shot, on a black boom arm with a shock mount and a pop filter, correctly scaled and lit like a real object in the room. It must not cross or obscure the book cover. No logos or brand names on it.

PEOPLE AND FRAMING
Show the host at least from the top of the head to the upper chest. Never crop the top of his head and never cut the face off at the chin or neck.

EXPRESSION (NON-NEGOTIABLE)
A slight, closed-mouth smile. The quiet, content expression of a man enjoying a good book: the corners of his mouth gently lifted, lips together, no teeth showing. His eyes are warm, alert and interested, engaged with the book or the lens, never blank, bored, glazed or flat. He looks absorbed rather than amused. No broad grin, no laughter, no open mouth, no raised eyebrows, no exaggerated surprise, no stiff passport stare. Do not default to the flat expression of the reference photo.

COLOUR - NON-NEGOTIABLE
Render the host in full, natural colour: lifelike skin tones and the true colour of his hair, beard, eyes and clothing exactly as in Image 1. Never render a person greyscale, monochrome, sepia, duotone, desaturated or as a flat colour-tinted cut-out, and never drain colour out of a face to help it blend into the background. The room MAY be dark and muted; the person must not be.

MANUAL HEADLINE AREA
Do not render any headline. Reserve ONE naturally dark, low-detail area of the room for a headline to be added later in Photoshop, at the top or bottom of the image, never left or right. It must be wide enough for one short line of large text, and it must read as part of the room: deep shadow, blurred background or empty darkness. Keep it clear of the face, the book cover and the microphone. ABSOLUTELY NO full-width black bar, black band, letterbox bar, hard-edged strip, banner, box, panel, rectangle, border or split caption area, and never add a graphic overlay. The photograph itself must reach every edge of the frame. If there is no natural place for the area, leave the background intact.

OPTIONAL PRODUCER DIRECTION
This may refine the room, props, wardrobe or lighting mood. It must NOT override the book rules, the expression, the framing or the no-text rule.


SCENE
A controlled, studio-lit reading nook at night. A deep green wall, a low charcoal armchair, a stack of three hardbacks on the floor, the rest of the room falling into soft shadow. The background is heavily out of focus but continuous to every edge of the frame. Intimate, still, close.

LIGHTING
Cinematic three-point studio lighting: a soft key from camera left, a subtle rim light on his hair and shoulders, and a single warm lamp just out of frame. Even, clean light across the book cover so every detail of it reads. No flare, no hot spots, no light falling across the cover.

Output a single 16:9 image. The fill-the-frame rule, ONE REAL PHOTOGRAPH, THE BOOK, EXPRESSION, PEOPLE AND FRAMING and the cover-text rule above always apply.
```


### No-cover option 4 - Nook, reading on the desk

The reading nook, book open on the desk, high angle.

```text
SHOT
READING ON THE DESK. High three-quarter angle looking down: the book lies open on the desk in front of him, he leans over it reading, one hand on the page edge.

Create a 16:9 YouTube thumbnail photograph for a Bitcoin books-and-ideas show. The photograph fills the entire frame edge to edge: no letterboxing, no black bars, no borders, no bands, no solid strips.

SUBJECT
Image 1 is the host. Use it for LIKENESS ONLY: same face shape, hair, beard, eyes and skin tone. Do NOT copy the expression he happens to be wearing in Image 1. Follow the EXPRESSION block below exactly. Image 2 is the front cover artwork of the book. It must appear on the front of the book in the photograph, exactly as supplied.

ONE REAL PHOTOGRAPH (NON-NEGOTIABLE)
Build a single, believable photograph in one room, under one lighting setup, from one camera. The host, the book, the microphone and the furniture must share the same perspective, lighting direction, colour temperature and focus. Natural shadow and believable scale everywhere. Do not paste, cut out or superimpose the host. No cut-out edges, hard outlines or halos around the head, hair or clothing.

THE BOOK (NON-NEGOTIABLE)
It is a real hardback in a normal trade format, about 6 x 9 inches (15 x 23 cm), the size of an ordinary novel. It has a plain, dark, unprinted cover: no title, no author, no artwork, no logo and no lettering anywhere, on the front, spine or back. It is a physical object in his hands or on the desk, lit like everything else in the room, and it must read as an ordinary book, never oversized.

THE MICROPHONE
A professional large-diaphragm condenser microphone in shot, on a black boom arm with a shock mount and a pop filter, correctly scaled and lit like a real object in the room. It must not cross or obscure the book cover. No logos or brand names on it.

PEOPLE AND FRAMING
Show the host at least from the top of the head to the upper chest. Never crop the top of his head and never cut the face off at the chin or neck.

EXPRESSION (NON-NEGOTIABLE)
A slight, closed-mouth smile. The quiet, content expression of a man enjoying a good book: the corners of his mouth gently lifted, lips together, no teeth showing. His eyes are warm, alert and interested, engaged with the book or the lens, never blank, bored, glazed or flat. He looks absorbed rather than amused. No broad grin, no laughter, no open mouth, no raised eyebrows, no exaggerated surprise, no stiff passport stare. Do not default to the flat expression of the reference photo.

COLOUR - NON-NEGOTIABLE
Render the host in full, natural colour: lifelike skin tones and the true colour of his hair, beard, eyes and clothing exactly as in Image 1. Never render a person greyscale, monochrome, sepia, duotone, desaturated or as a flat colour-tinted cut-out, and never drain colour out of a face to help it blend into the background. The room MAY be dark and muted; the person must not be.

MANUAL HEADLINE AREA
Do not render any headline. Reserve ONE naturally dark, low-detail area of the room for a headline to be added later in Photoshop, at the top or bottom of the image, never left or right. It must be wide enough for one short line of large text, and it must read as part of the room: deep shadow, blurred background or empty darkness. Keep it clear of the face, the book cover and the microphone. ABSOLUTELY NO full-width black bar, black band, letterbox bar, hard-edged strip, banner, box, panel, rectangle, border or split caption area, and never add a graphic overlay. The photograph itself must reach every edge of the frame. If there is no natural place for the area, leave the background intact.

OPTIONAL PRODUCER DIRECTION
This may refine the room, props, wardrobe or lighting mood. It must NOT override the book rules, the expression, the framing or the no-text rule.


SCENE
A controlled, studio-lit reading nook at night. A deep green wall, a low charcoal armchair, a stack of three hardbacks on the floor, the rest of the room falling into soft shadow. The background is heavily out of focus but continuous to every edge of the frame. Intimate, still, close.

LIGHTING
Cinematic three-point studio lighting: a soft key from camera left, a subtle rim light on his hair and shoulders, and a single warm lamp just out of frame. Even, clean light across the book cover so every detail of it reads. No flare, no hot spots, no light falling across the cover.

Output a single 16:9 image. The fill-the-frame rule, ONE REAL PHOTOGRAPH, THE BOOK, EXPRESSION, PEOPLE AND FRAMING and the cover-text rule above always apply.
```


---

## Loose ends

### Done
- [x] Expression locked to V1.
- [x] Four options are the four liked looks (two rooms, two poses).
- [x] Book scale, closed-book and front-cover rules added.
- [x] Prompt rows in Airtable: `Read Thumbnail`, `Read Book Cover`, `Read Book No Cover`, `Read Scene Study`, `Read Scene Nook`.
- [x] `Book Cover` field on `Episodes` (`fldoE43HUNe8nLwX4`).
- [x] Black-bar wording fixed in all six existing artwork prompts.
- [x] Mood default changed to Neutral; Reads forced to Neutral. *(Superseded 2026-10-28: Reads accept an expression pick; empty means Neutral.)*

### Airtable still to do
- [ ] `Artwork Settings` -> `Read` row: tick `Generate 16x9` and `Generate 1x1`, leave `9x16` off, update the "Manual artwork" note. Not flipped yet, because it arms generation.
- [ ] Live `System Map` row needs a reconciliation pass against the repo copy (unrelated drift).

### Read build
- [x] Artwork: `read` layout hardcoded/`Plan Downloads`/`Build Image Requests`.
- [x] Artwork: fixed four-look mapping, two camera / two book, two rooms.
- [x] Artwork: cover download and Image 2 pass.
- [x] Artwork: no-cover branch when `Book Cover` is empty.
- [x] Artwork: guard for a Read with no `Book Cover` (warns on the pick message).
- [x] Artwork: caption each option by its look in the Telegram album.
- [x] Artwork: read-aware 1x1 reversion (`Read Reversion 1x1`).
- [x] Artwork: Path 3 revisions use `Read Artwork Revision` and preserve the cover.
- [x] Telegram assistant: book-cover photo route, clear-then-upload.
- [x] Metadata: `Read` summary voice.
- [x] Metadata: moods ask replaced by a book-cover ask for Reads.
- [x] Docs: readmes and System Map updated.
- [ ] End-to-end test on `BA-w0UvI6` (needs a transcript + packaging reply + cover first).

### Unproven
- [ ] Black-bar fix has had no real generation.
- [ ] Mood default has had no real run; check `moodSource`.
- [ ] The new book-scale and front-cover rules have had no generation.
- [ ] No-cover mode has never been generated.

### Environment and housekeeping
- [ ] Airtable MCP OAuth broken (`invalid client_id or mismatched redirect_uri`). Not blocking; the repo PAT works.
- [ ] Repo has many uncommitted changes from before this session; commit separately.
- [ ] The Read test docs are temporary; fold the winner into the readme and delete them.
