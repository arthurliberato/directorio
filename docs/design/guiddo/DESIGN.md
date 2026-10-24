# Guiddo — Design System (v1)

> **For Claude Code:** this is the source of truth for Guiddo's look and feel. Use the tokens in `tokens.css` (or the Tailwind theme in `tailwind.guiddo.js`); never hard-code colors. `reference/homepage.html` is the approved homepage — match it. Anything listed under **Parked** is NOT part of v1; don't use it.

---

## 1. Brand in one paragraph

**guiddo** — *la guía de doctores dominicanos.* A directory of doctors in the Dominican Republic with reviews from **confirmed patients**. Doctors pay to be listed; patients are people who can afford private consultations. The brand is the friend you ask *"¿Tú conoces un buen pediatra?"* — warm, trustworthy, clear. The visual world borrows from **clinic paperwork** (prescriptions, file labels) and **hospital wayfinding** (directional signs), kept calm and simple.

---

## 2. Logo

- Wordmark: **`guiddo`**, always lowercase.
- Font: **Nunito 900 (Black)**.
- Tracking: `letter-spacing: -0.05em` (≈ -2.5px at 50px).
- The **second `d`** is Guiddo Blue `#5E9BD6`. Everything else is Ink `#1A2A4C`.
- On Ink/Navy backgrounds: letters in Paper `#FFF7F0`, second d stays Guiddo Blue.
- Min size: 18px. Clear space: the width of one `o` on all sides.

```html
<span class="gd-logo">guid<span class="gd-logo__d">d</span>o</span>
```

**Don't:** uppercase it, outline it, add gradients/shadows, color a different letter, set it in any other font.

---

## 3. Color

Two neutrals (paper + ink), one signature, one tint. That's the whole palette.

| Role | Token | Hex | Use |
|---|---|---|---|
| Paper | `--gd-paper` | `#FFF7F0` | Page background (warm white) |
| Ink | `--gd-ink` | `#1A2A4C` | All text, primary buttons, dark sections |
| Guiddo Blue | `--gd-blue` | `#5E9BD6` | Logo d, accents, highlight words, buttons on Ink |
| Pale Blue | `--gd-blue-pale` | `#DDE8F4` | Hero, tinted surfaces, avatars, chips |

Added by us (not in the original kit): `--gd-soon` `#3FCDB4` (teal-green) marks the soonest available hour on the home board; ink text on it is ~7:1.

Derived (use via tokens, don't invent new ones):

| Token | Hex | Use |
|---|---|---|
| `--gd-blue-ink` | `#2F6DAB` | **Blue text under 18px** on Paper (links, "Ver todos", "38 pacientes confirmados") — passes AA |
| `--gd-blue-pattern` | `#C6D7EA` | i-pattern figures on Pale Blue |
| `--gd-card` | `#FFFDF9` | Receta card surface |
| `--gd-line` | `#E7DED6` | Hairline borders on Paper |
| `--gd-navy-tone` | `#24375F` | Cropped letters on Ink |
| `--gd-navy-pattern` | `#2A3C61` | i-pattern figures on Ink |

**Rough ratio on a screen:** 60% Paper · 25% Pale Blue · 10% Ink · 5% Guiddo Blue.

**Contrast rules**
- `#5E9BD6` on Paper is ~2.9:1 → only for **large/bold display text (≥ 24px)**, the logo, icons, and decorative shapes. For small blue text use `--gd-blue-ink`.
- Paper text on Guiddo Blue is ~2.8:1 → only large bold text (button labels ≥ 13px/800 are borderline; prefer Paper on Ink for small labels).
- Guiddo Blue on Ink is fine (~4.9:1).

---

## 4. Typography

| Role | Font | Weight | Size / line-height | Notes |
|---|---|---|---|---|
| Logo | Nunito | 900 | — | See §2 |
| Display (H1) | Nunito | 900 | 33px / 1.02, `-1.2px` | Mobile hero. Desktop: 48–56px / 1.02 |
| Section title (H2) | Nunito | 900 | 20–26px / 1.05, `-0.4px` | |
| Card title | Nunito Sans | 800 | 16px / 1.25 | Doctor names |
| Body | Nunito Sans | 400 / 700 | 14–16px / **1.25** | Default UI text |
| Long-form body | Nunito Sans | 400 | 16px / 1.35 | Bios, articles only |
| Buttons, chips | Nunito Sans | 800 | 13px | |
| Label / receta detail | JetBrains Mono | 500 | 11px / 1.4, `+0.2px`, UPPERCASE for labels | "Clinic paperwork" voice — small doses only |

- Emphasis = **color**, not underline: highlight a key phrase in Guiddo Blue (display sizes only).
- Two families carry the brand (Nunito + Nunito Sans); mono is a seasoning for labels, receta details and footer.

```html
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@900&family=Nunito+Sans:wght@400;700;800&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
```

---

## 5. Shape, spacing, layout

- **Corners are small and calm:** `6px` for cards, inputs, buttons; `4px` for chips and sign rows. No pills except none — keep it tailored.
- **Borders:** `1px solid var(--gd-line)` on Paper. No shadows. No gradients.
- **Spacing scale:** 4 · 6 · 8 · 10 · 12 · 16 · 20 · 22 · 24 · 32 px. Mobile side gutter **16px**. Sections separated by ~22px vertical.
- Mobile-first; max content width on desktop ~1120px. Section titles always preceded by a mono label (e.g. `ESPECIALIDADES`).

---

## 6. Graphic devices (approved)

### 6.1 The i pattern
The `i` in guiddo is a little person (stem + dot). Repeated **upright** in a staggered grid, it's the brand pattern. One figure in ~7 is highlighted (Guiddo Blue body, Ink head on Pale Blue; Guiddo Blue body, Paper head on Ink). Use it in a corner of the hero and of dark sections — partially cropped, never full-bleed behind text.

- Figure: body `8×15`, `rx 4`; head `r 4`, 6px above body.
- Grid: 32px columns, 28px rows, every other row offset 16px.
- See `GuiddoPattern` snippet in §9.

### 6.2 Cropped letters
Giant `dd` in Nunito 900 (≈220px on mobile, `letter-spacing:-14px`), tone-on-tone, bleeding off a corner of a section. On Ink use `--gd-navy-tone`; on Pale Blue use `--gd-blue-pattern`. Decorative only (`aria-hidden`).

### 6.3 Señalización (wayfinding signs)
Specialty navigation looks like a hospital directory: stacked rectangular signs with a **pointed right end** (`clip-path`), name in Nunito 900, a short plain-language hint ("Niños", "Piel"), and a mono count + arrow on the right. Color order cycles Ink → Guiddo Blue → Pale Blue → Pale Blue.

### 6.4 Receta (prescription card)
Doctor cards look like a prescription slip: `Rx` header with a mono slip number, avatar + name + specialty, a mono key/value block (ZONA · ARS · HORARIO), a **dashed perforation line**, then the confirmed-patients count and "Ver perfil →". Surface `--gd-card`, 1px `--gd-line` border, 6px radius. Also the format for the shareable doctor card (WhatsApp/OG image).

---

## 7. Components (v1)

All are implemented in `reference/homepage.html` using classes from `tokens.css`.

| Component | Class | Spec |
|---|---|---|
| Header | `.gd-header` | Logo left, "Para doctores" link right, 1px bottom line |
| Hero | `.gd-hero` | Pale Blue, mono kicker, H1 with blue highlight, search bar, i-pattern top-right |
| Search bar | `.gd-search` | Paper field, 6px radius, placeholder **"¿Qué te duele?"**, Ink "Buscar" button |
| Section head | `.gd-label` + `.gd-h2` | Mono label above Nunito title; optional "Ver todos" link right |
| Sign row | `.gd-sign` | See §6.3 |
| Receta card | `.gd-rx` | See §6.4 |
| Primary button | `.gd-btn` | Ink bg, Paper text, 6px, 13px/800, padding 9×16 |
| Button on dark | `.gd-btn--blue` | Guiddo Blue bg, Paper text |
| Dark section | `.gd-dark` | Ink bg, mono label in Guiddo Blue, cropped `dd` |
| Footer | `.gd-footer` | Small logo + mono location |
| Confirmed count | `.gd-confirmed` | Check icon + "N pacientes confirmados", `--gd-blue-ink`, 12px/800 |

Icons: Tabler Icons, outline style, 14–20px, inherit text color.

---

## 8. Voice

- Spanish, Dominican, **tú**. Warm and direct, like a friend who knows doctors.
- Lead with questions people actually ask: *"¿Tú conoces un buen pediatra?"*, *"¿Qué te duele?"*, *"¿Hacia dónde vas?"*
- Proof over hype: *"38 pacientes confirmados"*, *"Solo doctores verificados."* Don't show big totals until they're impressive.
- Plain-language hints next to medical terms: Pediatría · Niños, Dermatología · Piel, Cardiología · Corazón.
- Doctor side: *"Tus pacientes ya te recomiendan. Haz que los próximos te encuentren."*

---

## 9. Snippets

**i pattern (React/TSX)**
```tsx
export function GuiddoPattern({ cols = 5, rows = 4, base = "var(--gd-blue-pattern)", hiBody = "var(--gd-blue)", hiHead = "var(--gd-ink)", className = "" }) {
  const figs = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = 14 + c * 32 + (r % 2) * 16, y = 6 + r * 28, hi = (r * cols + c) % 7 === 3;
    figs.push(<g key={`${r}-${c}`}>
      <rect x={x - 4} y={y + 7} width={8} height={15} rx={4} fill={hi ? hiBody : base} />
      <circle cx={x} cy={y + 1} r={4} fill={hi ? hiHead : base} />
    </g>);
  }
  return <svg viewBox={`0 0 ${cols * 32} ${rows * 28 + 8}`} className={className} aria-hidden="true">{figs}</svg>;
}
// On Ink: <GuiddoPattern base="var(--gd-navy-pattern)" hiBody="var(--gd-blue)" hiHead="var(--gd-paper)" />
```

**Sign shape**
```css
.gd-sign { clip-path: polygon(0 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 0 100%); }
```

---

## 10. Don'ts

- No pills, blobs, arches, waves, doodles, gradients, drop shadows.
- No stock "medical" clichés (hands holding hearts, crosses, stethoscope icons as decoration).
- No new colors outside the tokens. No small text in `#5E9BD6` on Paper.
- Don't put the i pattern or cropped letters behind body text.
- Don't use mono for paragraphs.

---

## 11. Parked (explored, not in v1 — do not implement)

- **Mascot:** the i figure in poses (saltando, saludando, señalando, pediatría, doctor y paciente) + tilted "hopping" i in the logo.
- **Stickers (accents only, later):** curita "guiddo"/"Verificado", two-tone capsule, paleta "¡Te la ganaste!" for post-review thanks, heartbeat line.
- **Shapes:** colonial arches for photo frames, waves/scallops between sections, hand-drawn doodles.
- **Objects:** floor-line wayfinding, weekly pastillero as schedule picker, blister-pack filters, hospital wristband on reviews, "Su turno" ticket for confirmations, file-folder tabs on profiles, eye-chart poster ("¿Lo ves claro?").
- **Alternatives considered:** Plus Jakarta Sans logo; peach / peach-sand `#F4D0B7`, sage `#E0E6D3`, lilac tints; dark editorial doctor materials; geometric dd monogram.
