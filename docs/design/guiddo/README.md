# Guiddo design kit (v1)

Drop this folder into the project root as `design/`, then give Claude Code the prompt below.

| File | What it is |
|---|---|
| `DESIGN.md` | The design system: logo, colors, type, shapes, graphic devices, components, voice, don'ts, parked ideas |
| `tokens.css` | CSS variables + ready component classes (`.gd-logo`, `.gd-hero`, `.gd-sign`, `.gd-rx`, …) |
| `tailwind.guiddo.js` | Same tokens as a Tailwind theme extension (for Lovable / shadcn projects) |
| `reference/homepage.html` | The approved mobile homepage, built only with the tokens. Open it in a browser |

## Prompt for Claude Code

```
Read design/DESIGN.md fully before touching any UI. It is the source of truth for Guiddo's look and feel.

1. Load the three Google Fonts from DESIGN.md §4 and import design/tokens.css globally.
2. Merge design/tailwind.guiddo.js into the Tailwind theme (extend, don't replace).
3. Rebuild the homepage to match design/reference/homepage.html — same structure, spacing and components — as reusable components: Header, Hero (with GuiddoPattern), SearchBar, SpecialtySigns, RecetaCard, DoctorCTA (dark section), Footer.
4. Use only tokens; no hard-coded colors. Small blue text uses blue-ink (#2F6DAB), never #5E9BD6.
5. Do not use anything listed under "Parked" in DESIGN.md §11.
6. Mobile-first; check it at 375px and at desktop width, and tell me what you changed.
```
