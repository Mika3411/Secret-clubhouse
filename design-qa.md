# Design QA — proche autorisé multi-familles

## Comparison target

- Source visual truth: `.design-reference/secret-clubhouse-source.png`
- Implementation screenshots:
  - `.design-reference/trusted-adult-multi-family-desktop.png`
  - `.design-reference/trusted-adult-multi-family-conversations.png`
- Source pixels: 853 × 1844.
- Implementation pixels and CSS viewport: 1280 × 720 at device scale factor 1.
- Density normalization: qualitative comparison at displayed size because the source is a portrait child-home composition while the implementation is the distinct protected-adult desktop/tablet state. The source is used as the visual-language truth, not as an identical layout target.
- State: authenticated trusted adult linked to two unrelated families, with one child and a different relationship in each family.

## Full-view comparison evidence

The source and implementation were opened together in the same comparison pass. The implementation preserves the source’s deep indigo canvas, mint and violet accents, rounded white surfaces, friendly Baloo/Nunito hierarchy, large touch targets, and simple bottom navigation. The adult view intentionally replaces the child-oriented hero, QR action, and friend carousel with family-labelled permission groups.

## Focused evidence

The dashboard screenshot keeps both family headings visible in the initial viewport. The conversations screenshot is the focused region for identity disambiguation: every row includes the relationship and family name before availability. No additional crop was required because all labels, permissions, and actions are readable at 1280 × 720.

## Required fidelity surfaces

- Fonts and typography: Baloo/Nunito hierarchy, weights, line height, wrapping, and small-label optical weight remain consistent with the source language.
- Spacing and layout rhythm: 20–26 px radii, card gaps, inset family groups, and the fixed two-item navigation use the established rhythm without overlap or horizontal overflow.
- Colors and visual tokens: indigo, mint, violet, white, and muted lavender surfaces match the selected Secret Clubhouse palette with readable contrast.
- Image quality and assets: no new raster illustration was needed; the implementation reuses the existing avatar and Phosphor icon components rather than introducing placeholder art or handcrafted SVG/CSS drawings.
- Copy and content: the dashboard explains the multi-family model directly, while cards and conversations repeat the family and relationship only where it prevents ambiguity.

## Comparison history

1. Initial comparison found one P2 information-context issue: the dashboard separated families, but conversation rows still said only “Mon jeune proche”.
2. Fixed by attaching each authorized child’s family metadata to the trusted-adult conversation view. Rows now show examples such as “Grand-parent · Famille Camille” and “Oncle ou tante · Famille Chloé”; the selected thread repeats the same context.
3. Post-fix browser evidence confirmed the two labelled groups, two labelled conversation rows, thread opening, and return navigation. The focused E2E scenario also passed at 390 × 844 with no horizontal overflow.

## Findings

No actionable P0, P1, or P2 findings remain.

## Follow-up polish

- P3: custom illustrated adult avatars could enrich the account marker later, but the existing account avatar is consistent and does not reduce comprehension.

## Verification

- Primary interactions tested: existing trusted adult login, second-family invitation acceptance, two-family dashboard, conversation list, thread opening, and return to “Mes proches”.
- Responsive functional check: 390 × 844, both family groups reachable, no horizontal overflow.
- Browser-rendered error state: none visible during the verified flow.

final result: passed
