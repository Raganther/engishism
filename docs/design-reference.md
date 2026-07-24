# Design Reference — DCU International Academy

**Purpose:** Visual language for the Classroom Game Hub MVP, emulating the DCU
International Academy website so the demo looks like it belongs to the school.

> Colours and type below are **eyeballed from website screenshots**, not the
> official brand guide. Treat them as a close starting point and refine against
> DCU's real brand assets before anything goes external. Screenshots captured
> July 2026 from the DCU International Academy homepage.

---

## 1. Colour palette

The identity runs on four colours over white: a deep **navy**, a bright **sky
blue**, a warm **yellow/gold**, and a pale **cream**. Navy and yellow carry the
type; sky blue carries the big hero blocks and primary buttons; cream softens
the geometric pattern work.

| Role | Name | Hex (approx.) | Used for |
|---|---|---|---|
| Primary dark | Navy | `#12263F` | Logo, nav text, headings, dark shapes |
| Primary bright | Sky blue | `#00A0DF` | Hero background, "Apply now" button, shapes |
| Accent | Yellow / gold | `#FFC20E` | Headline text, highlight shapes, calls to attention |
| Soft accent | Cream | `#FBF3D5` | Pattern fills, light backgrounds |
| Surface | White | `#FFFFFF` | Page background |
| Text on light | Navy | `#12263F` | Body copy |
| Text on blue/navy | White / cream | `#FFFFFF` / `#FBF3D5` | Copy over dark or blue blocks |

**Contrast notes for projection (per requirement F5.3):**
- Yellow `#FFC20E` on navy `#12263F` — high contrast, good for big headings.
- Yellow on white — **low contrast**, avoid for text; fine for shapes only.
- Navy on cream / white — safe for body copy.
- White on sky blue — good; navy on sky blue also works for shorter text.

### CSS custom properties (drop-in)

```css
:root {
  --dcu-navy:   #12263F;
  --dcu-blue:   #00A0DF;
  --dcu-yellow: #FFC20E;
  --dcu-cream:  #FBF3D5;
  --dcu-white:  #FFFFFF;

  /* semantic aliases */
  --bg:            var(--dcu-white);
  --ink:           var(--dcu-navy);
  --hero-bg:       var(--dcu-blue);
  --headline:      var(--dcu-yellow);
  --btn-primary:   var(--dcu-blue);
  --btn-primary-t: var(--dcu-white);
  --pattern-1:     var(--dcu-navy);
  --pattern-2:     var(--dcu-yellow);
  --pattern-3:     var(--dcu-cream);
  --pattern-4:     var(--dcu-blue);
}
```

---

## 2. Typography

- **Headlines:** heavy, near-black weight, **UPPERCASE**, tight leading. A
  geometric/grotesk sans (DCU's site reads like a Founders-Grotesk-style face).
  Set big and confident — the hero headline dominates its block.
- **Navigation:** uppercase, medium weight, navy, letter-spaced. Multi-word
  items stack onto **two lines** (e.g. "PATHWAY / PROGRAMMES").
- **Body:** clean humanist sans, navy on light, comfortable leading.

**Web-safe / offline-friendly stack** (the game hub must run offline — no CDN
fonts): prefer a self-hosted or system grotesk. Reasonable fallback stack:

```css
--font-head: 'Space Grotesk', 'Arial Black', system-ui, sans-serif;
--font-body: 'IBM Plex Sans', system-ui, -apple-system, Segoe UI, sans-serif;
```

If exact match matters for the demo, self-host the chosen fonts as local
`@font-face` files rather than linking Google Fonts, so it works with no
internet (requirement N2).

---

## 3. Layout & components

### Header / nav
- Logo top-left (navy wordmark: **DCU** bold + "International Academy" stacked).
- Right side: small social icons, then two buttons — **"Contact us"** (outlined,
  navy border on white) and **"Apply now"** (solid sky-blue fill, white text).
- Nav row beneath: uppercase two-line labels, evenly spaced, navy.

### Hero
- Split layout: **left** a solid sky-blue block holding the headline (yellow,
  uppercase) plus a supporting line in white/cream; **right** a photo (students,
  warm and candid).
- Optional prev/next carousel arrows as small navy squares on the hero edges.

### Signature geometric band
The defining motif: a horizontal **strip of interlocking geometric shapes** —
semicircles, quarter-circles, triangles, and full circles — alternating navy /
yellow / cream / sky blue. It acts as a divider between sections and as
decorative punctuation. Shapes are flat, hard-edged, no gradients.

Building blocks to reproduce it:
- Half-circles (`border-radius: 100% 100% 0 0` on a half-height box)
- Quarter-circles (`border-radius: 100% 0 0 0`)
- Triangles (CSS borders or `clip-path: polygon(...)`)
- Full dots (`border-radius: 50%`)
Lay them in a repeating row, cycling the four palette colours.

### Buttons
- **Primary:** solid sky blue, white uppercase label, generous padding, small
  radius (~4–6px) — squared, not pill.
- **Secondary:** white with navy outline, navy uppercase label.

### Overall feel
Professional but friendly and playful — driven almost entirely by **flat colour
blocks and geometric shapes**, minimal shadow, lots of white space. Emulate the
*shapes and colour rhythm*, not just the palette.

---

## 4. Applying this to the Game Hub

Current `game-hub-unit4.html` uses a navy/gold/teal/coral scheme on a dark
gradient. To align with DCU:

1. Swap the palette to the variables in §1 (navy + sky blue + yellow + cream).
2. Move from the dark gradient background toward **white/cream with sky-blue and
   navy blocks** — the site is light and airy, not dark.
3. Use the **geometric band** as the header underline and as the divider above
   the score bar.
4. Make headings uppercase grotesk; primary "Start / Build board" buttons solid
   sky blue.
5. Keep large, high-contrast text for classroom projection.

---

## 5. To refine later
- Replace approximate hex values with official DCU brand colours.
- Confirm the real headline typeface and self-host it for offline use.
- Save clean copies of the logo and the geometric-band artwork into
  `assets/images/brand/` if licensing for internal use is confirmed.
