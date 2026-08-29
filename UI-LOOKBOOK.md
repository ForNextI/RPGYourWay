# RPG Your Way UI Lookbook

**Status:** Canonical UI design contract
**Audience:** AI/webmaster/developer first; human-readable second
**Established:** Canonicalized for the RPG Your Way 1.13.0 consolidation
**Authority:** If existing CSS/components disagree with this lookbook, the lookbook wins unless Brett explicitly changes a rule.

---

## 0. Core rule

The **landing page is the visual reference implementation** for RPG Your Way.

Do not invent page-local visual dialects. The site should look as though a small, fixed kit of physical objects was reused everywhere, in the same way a theme-park/film-production lookbook defines repeated materials, hardware, colors, depth, and interaction states.

The goal is **standardization of visual grammar**, not making every object identical.

A webmaster should be able to receive an instruction such as:

> "Try a cream button there."

and know the complete construction, colors, edge treatment, dimensionality, text treatment, hover state, pressed state, and focus treatment without further clarification.

---

# 1. Canonical terminology

Use these words exactly in future UI discussions and implementation notes.

## 1.1 Plaque

A **plaque** is a comparatively large background plane with other UI objects sitting on top of it.

Examples:
- a dark olive region containing several cream buttons;
- a forest-green background plane supporting controls;
- a large section backing behind nested accordions.

A plaque is **not primarily an action control**.

## 1.2 Nameplate

A **nameplate** is a rounded, dimensional, labeled object sitting on a plaque that **does not perform an action**.

Examples:
- a static section label;
- a small "Your Campaign" label;
- a static mode/status title.

## 1.3 Button

A **button** is a rounded, dimensional, labeled object sitting on a plaque that **does perform an action**.

A button may also represent a persistent selected/open state.

## 1.4 Card

A **card** is a larger rounded content object, usually square-ish or substantially larger than a normal button/nameplate.

Cards may contain text, controls, images, status, or nested objects.

A card is not automatically interactive. If the whole card performs an action, its behavior must still follow the button interaction language.

## 1.5 Inset

An **inset** is a recessed content area. It visually sits below its surrounding surface.

Typical use:
- gameplay/transcript reading surface;
- text well;
- console screen;
- chat/conversation field.

## 1.6 Bezel

A **bezel** is the dimensional frame around an inset.

The standard bezel must read as **recessed**, not as another raised card.

## 1.7 Accordion screw

The **accordion screw** is the standardized round `+ / ×` hardware at the right side of expandable controls.

It is not a decorative icon that may be recolored independently on each page. It is one canonical piece of UI hardware.

---

# 2. Canonical palette

The named UI surface colors are:

| Design name | Canonical token | Hex | Purpose |
|---|---|---:|---|
| **Forest green** | `--rpgyw-forest` | `#043A2D` | strongest structural anchor; active/open/selected surfaces; dark headers |
| **Dark olive green** | `--rpgyw-olive-dark` | `#6F7946` | major backing plaques; secondary dark structural surface |
| **Light olive green** | `--rpgyw-olive-light` | `#D6D1A3` | resting buttons/accordion surfaces; light structural planes |
| **Cream** | `--rpgyw-cream` | `#F6EAD4` | light structural surface; light text on dark surfaces; button/nameplate face |
| **Parchment** | `--rpgyw-parchment` | `#F2DFB8` | warm innermost reading/content surface |

The following are **support/material/accent values**, not additional named surface colors:

| Material/accent | Canonical token | Hex | Purpose |
|---|---|---:|---|
| Lime | `--rpgyw-lime` | `#C1DC4D` | hover/focus interaction accent; never a major surface |
| Brass dark | `--rpgyw-brass-dark` | `#7A6031` | lower edge/depth/shadow |
| Brass mid | `--rpgyw-brass-mid` | `#A88A4D` | canonical visible brass rim |
| Brass light | `--rpgyw-brass-light` | `#D7BD7B` | brass highlight |
| Forest detail line | `--rpgyw-forest-line` | `#07563F` | fine contrast line on light raised objects |

### 2.1 Environmental tan is not a component color

The tan hex-map/page background remains the environment/backdrop. It is **not** a normal plaque/button/card surface choice. Avoid placing tan UI planes on the tan map where they disappear into the page.

### 2.2 No ordinary true white

Do not introduce stark `#FFFFFF` as a normal UI surface or normal light text color.

When legacy discussion says "white" in phrases such as "forest green with white lettering," interpret that as **canonical cream** unless Brett explicitly asks for literal white.

Highlights should likewise be derived from cream/brass rather than introducing pure white wherever practical.

### 2.3 Parchment is not cream

This distinction is intentional.

- **Cream** is structural/UI light material.
- **Parchment** is the warmer reading/content material.

The existing landing-page hero console's warm inset screen is the reference for parchment. Do not invent a new sixth beige.

---

# 3. Dimensional construction language

## 3.1 Global physical rule

**Nothing that reads as a button, nameplate, plaque, or card should look flat.**

Objects should appear slightly constructed/molded:

- rounded geometry;
- subtle face gradient;
- top-side highlight;
- bottom-side depth;
- brass rim where applicable;
- small cast shadow;
- inner contrast line where applicable.

The dimensional effect is deliberately shallow. Avoid sci-fi chrome, exaggerated bevels, candy-gloss, or giant shadows.

## 3.2 Only intentional flat exception

The **top ribbon/header band** is the one intentionally flatter structural element.

The controls embedded in the ribbon remain dimensional objects.

## 3.3 Canonical raised edge stack

For ordinary raised **buttons and nameplates**, use the following visual cross-section:

1. surface color;
2. **1 px inner contrast line**;
3. **2 px brass-mid outer rim**;
4. subtle brass-light/top highlight;
5. brass-dark lower depth, approximately 2–3 px;
6. restrained soft cast shadow.

### Light surfaces

For cream, parchment, and light-olive raised objects:

- inner contrast line = forest detail line (`#07563F`);
- text = forest green (`#043A2D`).

This thin forest line is a **required polish detail**, not an optional flourish.

### Dark surfaces

For forest and dark-olive raised objects:

- inner contrast line = cream (`#F6EAD4`) or a cream-derived subtle line;
- text = cream by default.

## 3.4 Standard face gradient

Do not use a perfectly flat fill for raised objects.

The gradient should be subtle, for example:

```css
background: linear-gradient(
  180deg,
  color-mix(in srgb, var(--surface) 90%, var(--rpgyw-cream)),
  var(--surface)
);
```

For a cream face, use a cream-to-slightly-warmer-cream gradient instead of mixing toward literal white.

## 3.5 Press behavior

Pressable objects should physically depress by a small amount:

```css
transform: translateY(2px);
```

The lower cast/brass shadow should compress correspondingly.

Do not animate large movements.

---

# 4. Object recipes

## 4.1 Plaque recipe

A plaque is a background support plane, not a pressable control.

- rounded corners;
- shallow dimensional edge;
- restrained shadow;
- may use forest, dark olive, light olive, cream, or parchment depending on hierarchy;
- should contrast clearly with the environmental tan map and with the objects placed on it;
- does not hover or depress.

A page should generally use darker plaques to create visual weight and to keep pale controls from floating on pale backgrounds.

## 4.2 Nameplate recipe

A nameplate uses the canonical raised edge stack but has no hover/press behavior.

- standard brass rim;
- standard inner contrast line;
- shallow gradient;
- standard radius;
- text treatment based on surface color.

If an object changes state when clicked, it is not a nameplate. It is a button.

## 4.3 Button recipe

A button is the nameplate construction plus standardized interaction states.

### Light-surface button

Rest:
- specified light surface (usually light olive or cream);
- forest text.

Hover/focus:
- surface becomes **forest green**;
- lettering becomes **lime**;
- brass/contrast construction remains physically consistent.

Active/open/selected:
- surface remains **forest green**;
- lettering becomes **cream**;
- state stays latched until the action/state is reversed where appropriate.

Press:
- brief 2 px downward movement/depth compression.

### Forest button

Rest:
- forest surface;
- cream lettering.

Hover/focus:
- surface stays forest;
- cream lettering changes to lime.

Selected/open:
- forest surface;
- cream lettering.

Do not make the entire button lime.

### Dark-olive button

Use only where dark olive is needed for composition rather than forest.

Rest:
- dark olive surface;
- cream lettering.

Hover/focus:
- keep dark olive or move to forest according to the canonical component variant;
- lettering = lime.

**Do not invent a new hover behavior page-by-page.** Each reusable button component must have one declared variant.

## 4.4 Card recipe

Cards are larger than buttons/nameplates and use broader spacing.

- rounded;
- dimensional;
- brass rim/inner contrast line unless the card is intentionally a recessed/content-only object;
- can use any canonical surface color;
- should participate in page color balance rather than defaulting every card to cream/beige.

The landing-page three-card row is the reference for deliberate color alternation and visual rhythm.

---

# 5. Accordion system

## 5.1 Accordion header is a button

An accordion header is not a unique fourth control species. It is a **button with an accordion screw**.

Use the same dimensional construction as other canonical buttons.

## 5.2 Standard landing/top-level accordion state

For the major landing-page accordions (for example, **Why I created RPG Your Way** and **Who benefits from this site?**):

| State | Surface | Text | Screw |
|---|---|---|---|
| Rest | Light olive | Forest | Standard cream/forest/brass screw |
| Hover/focus | Forest | Lime | **Unchanged colors** |
| Open/selected | Forest | Cream | Screw rotates `+` → `×`; colors unchanged |

The screw never turns lime merely because the parent is hovered.

## 5.3 Standard accordion screw

Canonical hardware:

- circle;
- **35 px × 35 px** nominal size;
- cream face;
- forest inner detail line;
- brass rim;
- forest `+` glyph;
- subtle raised depth matching other small buttons;
- open state rotates the same plus by **45 degrees**, visually yielding an `×`;
- no color change between closed/open;
- no lime hover state on the screw itself.

Do not maintain page-local screw sizes unless a future accessibility requirement explicitly forces one. Default to the single canonical **35 px** screw everywhere.

## 5.4 Nested accordion layering

Color must communicate hierarchy/depth.

Canonical landing-page stack:

1. tan/map environment;
2. top-level light-olive accordion button;
3. when open, top-level button = forest/cream;
4. the top-level button remains a standalone object; it does **not** sit on a backing plaque while closed;
5. opening it reveals a **separate dark-olive plaque** below the button;
6. nested accordion buttons on that plaque = **light olive**;
7. deepest revealed text/content field = **parchment**.

Do not produce cream-on-cream-on-tan nesting with no visual depth change.

## 5.5 Three layers are enough

Do not put heavyweight brass bezels around every nested textual area.

Once the hierarchy has been established by plaque → button → parchment content, plain readable parchment content is acceptable. Avoid visual lasagna.

---

# 6. Bezel system

## 6.1 Standard bezel intent

A bezel must look **dropped into/recessed below** the surrounding object.

It is not a raised card turned inside out.

## 6.2 Standard bezel cross-section

Canonical default:

1. surrounding plaque/card surface;
2. **outer bezel rail** in forest or dark olive, depending on context;
3. outer bezel edge uses shading/inset shadow but **NO outer brass rim**;
4. optional inner olive step/rail;
5. **brass edge on the inner opening**, directly surrounding the inset content;
6. parchment inset/content surface;
7. inset shadow inside the parchment field.

The absence of brass on the outer perimeter is intentional. It creates the illusion that the bezel turns downward into a 90-degree recess. Brass belongs at the inner opening where it frames the content.

## 6.3 Standard gameplay/conversation bezel

Preferred sequence:

**forest outer rail → dark olive inner rail → brass inner edge → parchment inset**

This is the standard reference for conversation wells, chat wells, transcript/read areas, and similar large recessed fields.

## 6.4 Hero console exception

The landing-page hero console is explicitly allowed to be more complicated than the standard bezel system.

It is the hero object and has multiple decorative/material layers. **Do not simplify or normalize it merely because the standard bezel is simpler.**

When tuning the console, preserve its special construction and only make explicitly requested changes.

---

# 7. Layering and page composition

## 7.1 Every major page should visibly use the palette

Do not let entire pages become pale-olive/cream monocultures.

A major RPGYW screen should normally show meaningful presence of:

- forest green;
- dark olive;
- light olive;
- cream;
- parchment.

Not every color needs equal acreage, but the page should feel related to the landing-page lookbook.

## 7.2 Use dark plaques behind light controls

When pale buttons/cards are disappearing into the tan/map environment, prefer:

- forest or dark-olive backing plaque;
- cream/light-olive controls on top;
- parchment for innermost readable content.

This produces depth and avoids "oatmeal UI."

## 7.3 Change color when changing depth

When a user opens/nests something, do not reveal another region of the same color unless there is a strong reason.

Preferred semantic depth progression:

**environment → structural dark plaque → raised light control → parchment content**

Active/selected controls use forest as the strongest state signal.

---

# 8. Top ribbon/header

## 8.1 Ribbon itself

The top ribbon is the only intentionally flatter site structure.

Keep it simple and visually continuous.

## 8.2 Embedded ribbon controls

Buttons embedded in the ribbon are still canonical dimensional buttons.

The **fullscreen/maximize button must use the same outer size class as the RPG Your Way home/logo button**. Use the standard two-diagonal-arrow fullscreen icon centered/scaled appropriately.

Do not use a tiny unrelated utility-square species.

## 8.3 Fullscreen icon

Use the simpler **two-arrow** expand/contract icon family, not the four-corner icon.

## 8.4 Ribbon diamonds

Every jeweled/diamond separator in the ribbon must be the same:

- same dimensions;
- same rotation;
- same surface/material color;
- same spacing;
- same vertical alignment.

The diamond between **RPG Your Way** and **Your AIGM** is not an exception.

---

# 9. Landing page as lookbook

The landing page is not just marketing. It is the reference library for the application's visual system.

## 9.1 Hero console wording/state

Canonical current language includes:

- **Start A New Campaign**
- **Current Campaign**
- **Continue Adventure**

## 9.2 Hero console material exception

The console may retain its more elaborate bezel/layer stack.

The console's warm inset field defines canonical parchment.

## 9.3 Purpose accordions

**Why I created RPG Your Way** and **Who benefits from this site?** use the state table in §5.2.

Their opened nested area uses:

- dark olive backing plaque;
- canonical raised nested buttons;
- parchment final text/content fields.

## 9.4 Landing-page color rhythm

The landing page should deliberately alternate dark/light surfaces. The three-card feature row is a reference for this rhythm.

Do not "standardize" that rhythm away into three identical cream cards.

---

# 10. Start page / campaign cabinet

The Start page performs two primary user jobs:

1. start a new campaign;
2. open/manage an existing campaign.

The visual hierarchy must make the new-game path primary while keeping existing campaigns obvious and accessible.

## 10.1 Primary new-game path

Current canonical wording:

- **Start Here**
- **Choose This Game System**

### Start-page Step 1 palette

The Start page is a specific composition of the canonical objects:

- **Start Here** remains the forest-green Step 1 nameplate.
- The Step 1 backing plaque is **light olive green**.
- The current/default game-system accordion button is **forest green with cream lettering** at rest; on hover its lettering may turn lime while the forest surface remains.
- The standard accordion screw remains cream/brass with a forest symbol.
- Expanding the game-system chooser introduces **no additional backing plaque**. The system-choice buttons themselves are **dark olive green**, with the selected system **forest green + cream**.
- **Choose This Game System** is a **cream button**.

This creates a deliberate stack of forest nameplate → light-olive plaque → forest current-system button / dark-olive choices → cream confirmation button.

## 10.2 Existing campaign control

The compact secondary control should communicate existing-campaign management/imports without becoming a full-width competing primary action.

The campaign cabinet itself may expand wide after activation. The compact **Existing Campaigns, Controls & Imports** button must sit by itself; do not leave a full-width cream plaque behind the closed button. When opened, its contents appear on a separate **cream plaque** below.

Within that plaque:

- the campaign collection may use dark structural color for balance;
- an opened campaign is treated as an **inset**, with the readable control area on parchment;
- destructive controls still use the standard button construction and confirmation flow, not a square red exception;
- the **Import an Older Adventure** area is a **light-olive card** with a **cream Import Older Adventure button**.

## 10.3 Campaign rows

Each campaign is **one expandable button/plaque unit**, not:

- one campaign card containing Continue; plus
- a second Campaign Controls accordion beneath it.

Collapsed campaign row:

- campaign name;
- concise metadata;
- canonical accordion screw.

Open campaign row:

- header remains active forest/cream;
- campaign actions and administration appear directly below;
- Continue Adventure appears inside the opened campaign area;
- governance, membership, voting, leave/delete controls live there as appropriate.

---

# 11. Interaction rules

## 11.1 Hover means invitation, not selection

Lime is principally a **hover/focus text accent**.

It should not become a permanent selected text color.

## 11.2 Selected/open means forest + cream

For controls with persistent state, the standard selected/open state is:

- forest surface;
- cream lettering.

## 11.3 Focus visibility

Keyboard focus must remain obvious. Use a visible lime or brass/forest focus treatment that does not destroy the component's dimensional construction.

Do not rely only on color changes that are indistinguishable from hover.

## 11.4 Disabled state

Disabled buttons should retain their object identity but clearly lose activation affordance:

- reduced contrast/saturation;
- no hover transformation;
- no lime interaction response;
- `cursor: not-allowed` where appropriate.

Do not make disabled controls vanish into the background.

---

# 12. Implementation primitives

The codebase should converge toward a small set of canonical component/classes rather than accumulating page-specific CSS.

Suggested primitive vocabulary:

```text
RpgPlaque
RpgNameplate
RpgButton
RpgCard
RpgInset
RpgBezel
RpgAccordionButton
RpgAccordionScrew
```

Suggested surface modifiers:

```text
surface-forest
surface-olive-dark
surface-olive-light
surface-cream
surface-parchment
```

Suggested state/behavior modifiers:

```text
is-selected
is-open
is-destructive
is-compact
```

Do not create a new visual recipe merely because a new page needs a button.

---

# 13. Canonical CSS tokens

The stylesheet has one canonical RPG Your Way palette and geometry map. New UI must use these tokens rather than introducing near-duplicate page-local colors, radii, or hardware sizes.

```css
:root {
  /* Named UI surfaces */
  --rpgyw-forest: #043a2d;
  --rpgyw-forest-line: #07563f;
  --rpgyw-olive-dark: #6f7946;
  --rpgyw-olive-light: #d6d1a3;
  --rpgyw-cream: #f6ead4;
  --rpgyw-parchment: #f2dfb8;

  /* Interaction/material */
  --rpgyw-lime: #c1dc4d;
  --rpgyw-brass-dark: #7a6031;
  --rpgyw-brass-mid: #a88a4d;
  --rpgyw-brass-light: #d7bd7b;

  /* Shared geometry */
  --rpgyw-rim-spread: 2px;
  --rpgyw-accordion-screw: 35px;
  --rpgyw-radius-control: 14px;
  --rpgyw-radius-card: 18px;
  --rpgyw-radius-plaque: 20px;
}
```

The visible brass surround on a canonical raised object is **2 px**. A separate **1 px** forest/cream contrast line may sit inside that brass rim; it is not a second brass width. Thin internal separators may remain 1 px when they are clearly separators rather than object surrounds.

Legacy names such as `--cream-bright`, `--forest-deep`, `--landing-mint-*`, `--landing-olive-*`, and one-page color aliases are retired. Do not reintroduce them.

---

# 14. Standard raised-object CSS model

Reference implementation shape, not mandatory literal syntax:

```css
.rpgyw-raised {
  --surface: var(--rpgyw-cream);
  --detail: var(--rpgyw-forest-line);
  --text: var(--rpgyw-forest);

  border: 1px solid var(--detail);
  border-radius: var(--rpgyw-radius-control);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--surface) 90%, var(--rpgyw-cream)),
    var(--surface)
  );
  color: var(--text);
  box-shadow:
    0 0 0 var(--rpgyw-rim-spread) var(--rpgyw-brass-mid),
    inset 0 1px 0 color-mix(in srgb, var(--rpgyw-cream) 70%, transparent),
    inset 0 -2px 0 color-mix(in srgb, var(--rpgyw-brass-dark) 18%, transparent),
    0 3px 0 var(--rpgyw-brass-dark),
    0 7px 12px rgb(29 38 29 / .14);
}
```

For a dark surface:

```css
.rpgyw-raised.surface-forest,
.rpgyw-raised.surface-olive-dark {
  --detail: color-mix(in srgb, var(--rpgyw-cream) 78%, transparent);
  --text: var(--rpgyw-cream);
}
```

Do not use this as an excuse to add another override layer to every existing selector. The goal is to **replace duplicated recipes with shared primitives** during cleanup.

---

# 15. Standard bezel CSS model

Reference construction:

```css
.rpgyw-bezel {
  /* Recessed outer rail. No outer brass rim. */
  border: 0;
  border-radius: var(--rpgyw-radius-card);
  background: var(--rpgyw-forest);
  padding: 7px;
  box-shadow:
    inset 0 2px 5px rgb(0 0 0 / .24),
    inset 0 0 0 1px color-mix(in srgb, var(--rpgyw-cream) 22%, transparent);
}

.rpgyw-bezel__inner-rail {
  border: 0;
  border-radius: calc(var(--rpgyw-radius-card) - 5px);
  background: var(--rpgyw-olive-dark);
  padding: 6px;
  box-shadow: inset 0 2px 4px rgb(0 0 0 / .18);
}

.rpgyw-bezel__inset {
  border: 2px solid var(--rpgyw-brass-mid); /* brass belongs here */
  border-radius: calc(var(--rpgyw-radius-card) - 9px);
  background: var(--rpgyw-parchment);
  box-shadow:
    inset 0 5px 9px rgb(72 53 27 / .18),
    inset 0 0 0 1px color-mix(in srgb, var(--rpgyw-brass-light) 55%, transparent);
}
```

The important rule is conceptual: **no brass on the outer bezel edge; brass on the inner opening around parchment.**

---

# 16. Accordion screw CSS model

```css
.accordion-plus {
  position: relative;
  width: var(--rpgyw-accordion-screw);
  height: var(--rpgyw-accordion-screw);
  flex: 0 0 var(--rpgyw-accordion-screw);
  border: 1px solid var(--rpgyw-forest-line);
  border-radius: 999px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--rpgyw-cream) 92%, var(--rpgyw-parchment)),
    var(--rpgyw-cream)
  );
  color: var(--rpgyw-forest);
  box-shadow:
    0 0 0 var(--rpgyw-rim-spread) var(--rpgyw-brass-mid),
    inset 0 1px 0 color-mix(in srgb, var(--rpgyw-cream) 74%, var(--rpgyw-brass-light)),
    0 2px 0 var(--rpgyw-rim-spread) var(--rpgyw-brass-dark),
    inset 0 -2px 0 color-mix(in srgb, var(--rpgyw-brass-dark) 10%, transparent),
    0 5px 9px rgb(42 48 37 / .12);
  transition: transform 160ms ease;
}

[aria-expanded="true"] .accordion-plus,
details[open] > summary .accordion-plus {
  transform: rotate(45deg);
}
```

**No hover color override belongs on the screw.** Parent hover may change parent surface/text only.

---

# 17. Anti-patterns

Do not:

- create a seventh near-identical cream/olive token for one page;
- put light-olive cards on a tan map with no dark structural anchor;
- make an accordion screw lime on hover;
- use flat rounded rectangles for controls;
- use different brass widths/shadows for visually identical button species;
- use a separate "Campaign Controls" row when the campaign itself can be the accordion;
- use literal white when canonical cream serves the same role;
- add a brass outer rim to a standard recessed bezel;
- add another decorative bezel three levels deep around plain reading text;
- duplicate campaign administration inside Table Chat;
- let the top ribbon accumulate mismatched separator diamonds or utility-button sizes;
- solve inconsistency by appending another release-specific CSS override block at the bottom of `globals.css`.

---

# 18. Whole-site QA checklist

For every page, ask:

1. Does this page visibly belong to the landing-page visual family?
2. Is there enough forest/dark-olive structural weight, or is the screen mostly beige/light olive?
3. Are plaques, nameplates, buttons, cards, insets, and bezels being used according to their definitions?
4. Are all raised objects actually dimensional?
5. Does every light raised object have the thin forest contrast detail before the brass rim?
6. Do dark raised objects use the corresponding cream inner detail?
7. Are hover states canonical?
8. Are selected/open states forest + cream?
9. Does every accordion screw match the canonical screw exactly?
10. Are nested layers changing color as depth changes?
11. Are reading/content fields parchment rather than another arbitrary cream?
12. Does any standard bezel incorrectly have brass on its outside edge?
13. Are there stray true-white surfaces/text that should be cream?
14. Are there page-local button recipes that should be replaced by canonical primitives?
15. Are ribbon utility controls and diamonds consistent?
16. Is any new visual behavior being introduced merely because a new feature was added?

If the answer to #16 is yes, stop and reuse the lookbook instead.

---

# 19. Exceptions

Known/allowed exceptions must be explicit.

## 19.1 Landing hero console

Allowed to use a more elaborate multi-layer bezel/construction than ordinary site bezels.

## 19.2 Top ribbon

Allowed to remain predominantly flat as a structural band. Embedded controls remain dimensional.

No other exception should be invented casually. If a page requires one, document it in this section before implementing it.

---

# 20. Future work compatibility

## 20.1 AdSense

Planned ads should be simple and inserted immediately below the top ribbon on the selected pages. Do not invent a new decorative ad-card language that competes with the product UI. AdSense implementation must still respect layout spacing and the canonical page hierarchy.

## 20.2 VTT integration

Future VTT integration UI must use these same primitives. An integration page is not permission to invent a new sci-fi/dashboard theme.

---

# 21. Webmaster handoff rule

When continuing RPG Your Way UI work:

- read this file before changing shared UI/CSS;
- treat the landing page as the live visual lookbook;
- use the terminology in §1 when discussing changes;
- reuse canonical primitives before writing new CSS;
- prefer deleting/merging duplicate styling over layering new overrides;
- preserve compatibility/functional behavior while standardizing appearance;
- if Brett says only "cream button," implement the complete canonical cream-button recipe from this lookbook;
- if Brett changes a design rule, update this lookbook at the same time so the next webmaster inherits the new rule.

**The design system should become simpler as the site matures, not accumulate another generation of almost-the-same components.**


# 22. Current page-specific composition rules

These are current composition rules that sit on top of the canonical primitives above. They are not release-history notes. If a future change supersedes one, edit this section in place.

## 22.1 Start

- `Start Here` carries the plain subtitle **New Campaign** immediately beneath the nameplate.
- The persistent selected game-system control is forest with cream copy. Hover/focus keeps the forest face and changes the copy to lime. Its accordion screw does not recolor or resize.
- Open campaign controls shrink-wrap their current content. Campaign identity and **Continue Adventure** may share the first row; multiplayer members, votes, and administration add height only when present.
- Campaign-preference category labels are readable forest text on their olive rows.
- A completed guidance plaque carries the single prominent status **Your campaign guidance is set.** Do not add a completion-count subtitle.
- In the proposed-party-leader plaque, **Proposed party leader:** is an upper-left label. The proposed leader name is centered and is the visual event; Change/None/explanation actions remain secondary.
- Choice hover/focus changes the letters themselves to lime. Do not paint a separate highlighted slab behind the hovered copy.
- The final **Onward** control uses the full available Start-page width.
- Start-to-Play transition/status cards use canonical light olive rather than an ad-hoc translucent green.

## 22.2 Play

- The compact **Current party / Max party size** plaque stays fully inside the character rail and never clips or forces horizontal overflow.
- Dice quantity uses a rounded recessed opening. The quantity and die numbers are large forest text at rest.
- **Can I direct my game?** lives inside expanded Session tools rather than as a permanent second control.
- **Add another character** is a compact action button, not a full-width card.
- Gameplay text input has rounded inner corners and remains inside the composer bezel.
- The Play page may use Tailwind utilities for layout, but semantic Tailwind colors map back to the same canonical RPG Your Way palette.

## 22.3 Script

- Script is the working sequence **1 Upload or drop transcript → 2 Answer the questions → 3 See maximum usage**.
- Step numbers use the same cream, brass-rimmed rounded-square number tile established by Start. Step nameplates use the standard forest + cream treatment consistently.
- The intro is subordinate to the work; its headline does not consume the page like a landing hero.
- Preserve the dashed drag-and-drop boundary because it communicates a distinct drop interaction.
- Script accepts useful digital campaign records from RPG Your Way, other text-to-play games, other game systems, chat/campaign logs, and digitally recorded notes or written records from home tabletop play. The converter should do its best with any useful digital transcript/record.
- **Parchment means text/document surface on Script.** Use it for transcript drop/paste, text entry, and produced prose. Explanatory copy and grouping furniture use cream, light olive, dark olive, or forest instead.
- Script choice cards follow the standard state language: resting light/olive, selected/open forest + cream, hover/focus lime copy without a separate highlight slab.

## 22.4 Character record

- The character record is part of RPG Your Way, not a generic gray application panel.
- Major record sections are canonical accordions: **closed = light olive + forest**, **open = forest + cream**, **hover/focus = lime lettering while retaining the appropriate open/closed face**.
- Opened record content uses a **dark-olive backing plaque**. Stat, condition, list, and other informational panels inside it are **cream**.
- Parchment is reserved for true edit/text-entry/document surfaces, not generic record backgrounds.
- Nested accordions use the same 35 px canonical screw; no nested screw-size species.
- Character-record action buttons use the canonical raised button family. Primary editing is forest + cream; secondary actions are cream/light-olive + forest; hover/focus uses lime copy.
- **Remove this character** is not a permanent red exception. Its confirmation may become dark olive but stays in the house button family.
- Profile/edit workspaces are raised structural plaques with recessed parchment fields and rounded inner corners.

## 22.5 Account, auth, and informational pages

- Account/Auth uses the same raised button, accordion, plaque, and parchment-input recipes as the rest of the site. A sign-in/create-account action must never become a flat lime slab or another page-local color species.
- Account accordion: closed summary light olive + forest; open summary forest + cream; hover/focus copy lime; revealed backing may use dark olive with light cards on top.
- Support, Privacy, Terms, Accessibility, Read, and 404 use the same cream/brass/forest prose-card construction rather than generic framework cards.
- Semantic error, warning, and live-recording states may use dedicated warning colors when that distinction conveys real state. Those colors do not become ordinary furniture colors.

## 22.6 Validation and maintenance

- Release validation protects the **current semantic UI contract**, not exact CSS strings from old releases.
- When a canonical primitive changes, update its one source of truth and this lookbook rather than adding a new page-local override.
- Prefer deletion/merging over accumulating another late stylesheet layer.

