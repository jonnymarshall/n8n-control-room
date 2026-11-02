# Read episodes — artwork prompt (v2, after round-1 testing)

Status: **historical.** This was the round-2 candidate set; it was built and went live on 2026-10-22. The live wording and current behaviour live in the thumbnail workflow readme. **2026-10-28:** Reads no longer force `Neutral`; the `EXPRESSION` block is driven by `{{VIBE}}` and defaults to Neutral when no expression is picked.

## What changed after round 1

| Finding | Change |
|---|---|
| Shot 1 works | Kept, unchanged. It is the anchor shot. |
| Shot 2 came back with a black bar at the top | Root cause: the headline instruction said "or a smooth fade to black". The model drew the fade as a band. All fade-to-black wording is now gone; the reserved area must be a naturally dark part of the room, and full-width bars are banned in the first and last line. |
| Shot 2's room was disliked (not a studio look) | Scene B (the daylight loft) is dropped. Every shot now uses the same controlled studio-style set. |
| Shots 2 and 3 had the cover poorly superimposed | Cover must now face the camera square-on, at a stated minimum size, with hands only at the outer edges. Shot 2 is a closer lean-in rather than a pull-back. |
| Shot 4 is good but the cover is not visible | Shot 4 is now a **no-cover mode** only. With a cover, shot 4 is replaced by a desk pose where the cover faces the camera. |
| Reads skip moods | Prompt hard-codes a calm neutral expression, and the workflow will force the `Neutral` reference photo for all four slots. |

---

## The fixed rules (apply to every option)

Three things caused the failures above, so they are stated up front and again at the end:

1. **The image fills the frame edge to edge.** No letterboxing, no black bars, no borders, no bands, no solid strips. The background is a real room that continues to every edge.
2. **The cover is square to the lens.** Not foreshortened, not turned away, not angled so it reads as a sliver. Hands touch only the outer edges of the book.
3. **One photograph, one room, one light.** No pasted cut-outs, no floating cover rectangles.

---

## Scene A — the study (recommended)

Swap this block to change the set. Everything else stays put.

```
SCENE
A controlled, studio-lit study set at night. Deep charcoal panelling, a worn leather wing chair,
shelves of hardback books falling softly out of focus behind him, a brass reading lamp just off
camera throwing a warm pool of light across him and the book. A low side table with a glass of
water and reading glasses. The room continues to every edge of the frame: no wall, cloth or
backdrop ends inside the picture. Dark, quiet, expensive, deliberately lit.

LIGHTING
Cinematic three-point studio lighting: a soft key from camera left, a subtle rim light separating
his hair and shoulders from the background, and a dim warm practical lamp behind him. Even, clean
light across the book cover so every detail of it reads. No flare, no hot spots, no light falling
across the cover.
```

## Scene C — the reading nook

Alternative set, same rules.

```
SCENE
A controlled, studio-lit reading nook at night. A deep green wall, a low charcoal armchair, a stack
of three hardbacks on the floor, the rest of the room falling into soft shadow. The background is
heavily out of focus but continuous to every edge of the frame. Intimate, still, close.

LIGHTING
Cinematic three-point studio lighting: a soft key from camera left, a subtle rim light on his hair
and shoulders, and a single warm lamp just out of frame. Even, clean light across the book cover so
every detail of it reads. No flare, no hot spots, no light falling across the cover.
```

---

## The prompt body (paste this, with a scene block and a shot line)

```
Create a 16:9 YouTube thumbnail photograph for a Bitcoin books-and-ideas show. The photograph fills
the entire frame edge to edge: no letterboxing, no black bars, no borders, no bands, no solid strips.

SUBJECT
Image 1 is the host. Reproduce his likeness faithfully: same face shape, hair, beard, eyes and skin
tone. Image 2 is the front cover artwork of the book he is holding. It must appear on the front of
the book in the photograph, exactly as supplied.

ONE REAL PHOTOGRAPH (NON-NEGOTIABLE)
Build a single, believable photograph in one room, under one lighting setup, from one camera. The
host, the book, the microphone and the furniture must share the same perspective, lighting
direction, colour temperature and focus. Natural shadow and believable scale everywhere. Do not
paste, cut out or superimpose the host. No cut-out edges, hard outlines or halos around the head,
hair or clothing.

THE BOOK (NON-NEGOTIABLE)
It is a real hardback book with a visible page block, board thickness and natural weight. The front
cover faces the camera SQUARE ON and is fully visible: all four edges of the cover inside the frame,
no finger, hand, wrist, sleeve, hair, microphone or shadow across the cover face. Hands hold only
the outer edges of the boards. The cover is one of the two largest elements in the frame, at least
as wide as the host's head, and it is evenly lit so every detail reads.
Reproduce the supplied cover EXACTLY. Do not redraw, reinterpret, re-letter, translate, crop,
recolour, restyle or clean up anything on it. Every word, number, logo and illustration must match
Image 2. Image 2 is a flat artwork file, not a photograph of a room: do not paste it into the scene
as a flat rectangle and do not show it as a screen, poster or inset. Wrap it onto the front board of
the book with correct perspective.
The cover may contain its own title and author text. That is the ONLY text allowed in the image, and
it must be preserved exactly. Add no text of your own anywhere.

THE MICROPHONE
A professional large-diaphragm condenser microphone in shot, on a black boom arm with a shock mount
and a pop filter, correctly scaled and lit like a real object in the room. It must not cross or
obscure the book cover. No logos or brand names on it.

PEOPLE AND FRAMING
Show the host at least from the top of the head to the upper chest. Never crop the top of his head
and never cut the face off at the chin or neck. Calm, neutral, unforced expression: the look of
someone reading something serious and thinking about it. Mouth closed, no smile, no grin, no raised
eyebrows, no exaggerated surprise, no stiff passport stare.

COLOUR — NON-NEGOTIABLE
Render the host in full, natural colour: lifelike skin tones and the true colour of his hair, beard,
eyes and clothing exactly as in Image 1. Never render a person greyscale, monochrome, sepia,
duotone, desaturated or as a flat colour-tinted cut-out, and never drain colour out of a face to
help it blend into the background. The room MAY be dark and muted; the person must not be.

MANUAL HEADLINE AREA
Do not render any headline. Reserve ONE naturally dark, low-detail area of the room for a headline to
be added later in Photoshop, at the top or bottom of the image, never left or right. It must be wide
enough for one short line of large text, and it must read as part of the room: deep shadow, blurred
background or empty darkness. Keep it clear of the face, the book cover and the microphone.
ABSOLUTELY NO full-width black bar, black band, letterbox bar, hard-edged strip, banner, box, panel,
rectangle, border or split caption area. Do not add any graphic overlay. The photograph itself must
reach every edge of the frame. If there is no natural place for the area, leave the background
intact.

Output a single 16:9 image. The fill-the-frame rule, ONE REAL PHOTOGRAPH, THE BOOK, PEOPLE AND
FRAMING and the cover-text rule above always apply.
```

Order when pasting: **shot line first, then the prompt body, then the scene block.** Shot first is
deliberate (same reason as the live workflow: a trailing instruction gets ignored).

---

## The four shot lines (with a book cover)

Two looking at camera, two looking at the book.

**Option 1 — looking at camera, close**. Proven in round 1, unchanged.

```
SHOT
Variant 1 of 4 — LOOKING AT CAMERA. Medium close-up at eye level: the host faces the lens, holding
the closed book up at chest height with the front cover square to the camera.
```

**Option 2 — looking at camera, leaning in**

```
SHOT
Variant 2 of 4 — LOOKING AT CAMERA. Slightly wider than a close-up, still eye level: the host leans
toward the lens, the closed book held high against his chest with the front cover square to the
camera and fully visible. His shoulders and the top of the chair are in frame. Nothing crosses the
top or bottom edge of the picture.
```

**Option 3 — looking at the book, held**

```
SHOT
Variant 3 of 4 — LOOKING AT THE BOOK. Medium shot: the host holds the closed book in both hands at
chest height, the front cover turned square to the camera and fully visible, his head tilted down
and his eyes on the cover. His fingers grip only the outer edges of the boards. He is not looking at
the lens.
```

**Option 4 — looking at the book, resting on the desk**

```
SHOT
Variant 4 of 4 — LOOKING AT THE BOOK. The closed book stands on the desk in front of him, front
cover square to the camera and fully visible. He leans over it with one hand resting flat on the
desk beside it, looking down at the cover. Camera slightly above eye level, looking down at both.
He is not looking at the lens.
```

> Shot 4 was the desk pose before, but with the book open, which hid the cover. Standing it closed
> with the cover square is the fix. If the model still hides the cover, this option becomes another
> framing of shot 3.

---

## No-cover mode (when no book cover image exists)

Use the block below instead of `THE BOOK`, and these shots. The face is still the product, and the
book is just a book. No cover is visible in any of them, by design.

```
THE BOOK (NON-NEGOTIABLE)
It is a real hardback book with a plain, dark, unprinted cover and a visible page block, board
thickness and natural weight. No title, no author, no artwork, no logo and no lettering anywhere on
it, inside or out. The book is a physical object in his hands or on the desk, lit like everything
else in the room.
```

```
SHOT
Variant 1 of 4 — READING. Medium close-up at eye level: the host holds the book open in both hands
at chest height, looking down at the pages. The outside of the book faces the camera.
```

```
SHOT
Variant 2 of 4 — READING, WIDE. Wider three-quarter view: the host sits back in the chair with the
book open in his lap, looking down at it, more of the room visible around him.
```

```
SHOT
Variant 3 of 4 — READING ON THE DESK. High three-quarter angle looking down: the book lies open on
the desk in front of him, he leans over it reading, one hand on the page edge.
```

```
SHOT
Variant 4 of 4 — READING, SIDE ANGLE. Profile three-quarter shot: the host reads the open book held
at chest height, face lit by the key light, background falling away behind him.
```

---

## Test checklist

- [ ] No black bar, band, border or strip anywhere. Check all four edges.
- [ ] The cover matches Image 2 at full size: title, author, art, spelling.
- [ ] The cover is not foreshortened or partly turned away, and no hand covers it.
- [ ] The cover is at least as wide as his head.
- [ ] Likeness, natural skin colour, no cut-out edges.
- [ ] Calm neutral mouth and eyes in all four.
- [ ] Microphone plausible, not crossing the cover.
- [ ] One dark area for the headline that does not look like a band.
- [ ] Reads at 200px wide: the cover is still identifiable.

## Notes for the build

- Reference photo for Reads: force the `Neutral` mood row for all four slots. That is now wired: `Resolve Vibes` uses Neutral for Reads, and for every type when no mood is picked (2026-10-22).
- No-cover mode is chosen by whether `Book Cover` is empty, not by a manual switch. The field now exists on `Episodes` (`fldoE43HUNe8nLwX4`).
- The four shot lines and both book blocks are short enough to live as separate rows in the
  `Prompts` table, so they can be tuned without touching n8n. The long body stays in one row.
- The black bar is a prompt bug, not a workflow bug, so the fix is wording. No image QA step is
  planned; a bad option simply loses the pick.
