# Design QA — Telegram Mini App case, screenshot scale iteration

- Source visual truth: the owner's latest 2166×1354 capture at `/var/folders/ll/5zv9tsj54qn56lh6c6mtdtzh0000gn/T/TemporaryItems/NSIRD_screencaptureui_9CZuaN/Снимок экрана — 2026-08-24 в 13.39.42.png` and the direction to reduce empty space by enlarging the app screen while keeping it fully visible.
- Implementation: homepage `#cases` in the separate `wt/telegram-cases` worktree.
- Browser: local Chromium through Playwright, explicitly requested by the owner.
- Viewports: 1180×800, 1330×848, 1180×1000, and 390×844; device scale factor 1.
- Covered state: light theme; Yasmina at all four viewports; Yasmina Product (`02 / 09`) at the primary 1330×848 comparison state. The final flat order is Yasmina 01–03, Mariosa 04–06, and Zayac 07–09. Normal motion, queued clicks, reduced motion, the full cycle, and dark-theme behavior remain covered by the suite and prior artifacts.

## Agent review and chosen composition

- Three read-only agents checked visual composition, responsive constraints, and background treatment.
- All agreed that the transparent background, single screenshot border, and vertical arrow position were already correct and should stay unchanged.
- The chosen change combines their useful constraints: the desktop screen grows up to its source CSS size of 390×844, remains capped by viewport height, and the `bare` field now takes the gallery's intrinsic height instead of reserving an invisible 800 px track.
- The desktop stage follows the screen width. It keeps 12 px between the 44 px arrow target and the screenshot instead of leaving the controls at the edges of a fixed wide stage.
- The mobile size rules remain unchanged.

## Visual evidence and normalization

- Normalized source: `design-qa-artifacts/size-reference-1330x848.png` (1330×848), scaled from the owner's 2166×1354 capture with Lanczos resampling.
- Primary implementation: `design-qa-artifacts/size-after-1330x848-yasmina.png` (1330×848, CSS viewport 1330×848, DPR 1).
- Full-view side-by-side: `design-qa-artifacts/size-reference-vs-after.png` (2660×848).
- Responsive implementation captures: `size-after-1180x800.png`, `size-after-1180x1000.png`, and `size-after-390x844.png`.
- Yasmina Home re-encode comparison: `yasmina-home-original-vs-q48.png` (1560×1688; original left, optimized current asset right). The untouched 121.5 KB source is retained as `yasmina-home-before-order-reencode.avif`.
- Density note: the source capture's browser/device density is unknown, so it was normalized by exact aspect ratio and pixel dimensions. The implementation is a direct DPR-1 browser capture.
- State note: the source demonstrates the excessive-space composition but does not show the site header and does not keep the complete gallery inside the frame. The implementation intentionally places the gallery 8 px below the 65 px sticky header so the entire image and metadata remain visible; exact vertical pixel matching would recreate the reported defect.
- Focused comparison was not needed: the changed surfaces are the full-row proportions, image scale, control spacing, and viewport fit, all legible in the original-size full-view comparison. Screenshot imagery, typography, copy, and tokens were not edited.

## Measured result

- 1180×800: image ≈311.9×675 px; gallery 719 px tall and ends about 8 px above the viewport bottom.
- 1330×848: image 334.08×723 px; gallery 446.08×767 px, from y=73.48 to y=840.48.
- 1180×1000: image 390×844 px; gallery 888 px tall and remains fully visible.
- 390×844: image ≈297.6×644 px; the existing 688 px mobile gallery remains above the sticky CTA beginning at y=775.
- The former fixed 800 px transparent field is gone for `bare` media. At 1330×848 the field and gallery are both exactly 767 px tall.
- The desktop copy/gallery center delta at the primary viewport is 0.008 px.
- At the line registry's 1180×900 measurement viewport, the gallery is 819 px and `#cases` is 1642.33 px; `MEASURED_SECTION_HEIGHT.cases` is updated to 1642.
- The screen keeps its 780/1688 ratio, is never cropped or stretched, and does not exceed the original 390×844 CSS capture size.
- There is no horizontal overflow at any covered viewport. Both external arrow controls remain 44×44 px.

## Required fidelity surfaces

- Fonts and typography: unchanged Unbounded/Onest/JetBrains Mono hierarchy, weights, line heights, wrapping, and optical scale. The text block moves only because its row now follows the actual gallery height.
- Spacing and layout rhythm: the screenshot is 9–13% larger across the tested desktop heights; artificial vertical space is removed; arrows now keep a controlled 12 px desktop gap; the right copy remains centered against the complete gallery.
- Colors and visual tokens: unchanged. The case keeps the page background, token border, and flat controls; no surface card, shadow, gradient, or decorative frame was introduced.
- Image quality and asset fidelity: all nine AVIF files remain 780×1688. Making Yasmina Home the initial resource exposed a page-budget regression; that one file was re-encoded from 121.5 to 72.2 KB at the same dimensions. Side-by-side review, SSIM 0.9807, and PSNR 38.01 dB found no actionable visible degradation. The browser waits for `HTMLImageElement.decode()` before QA captures.
- Copy and content: title, description, stack, store name, alt text, and live status wording are unchanged. Counters now correctly follow the requested store order.

## Findings

- No actionable P0/P1/P2 issue remains.
- The source and implementation differ intentionally at the top edge because full gallery visibility is now an explicit requirement. The new composition fills the row more confidently without cropping the screen or hiding metadata.

## Comparison history

1. Earlier state: at 1180×800 the screen was ≈281.9×610 px; at 1330×848 it was ≈304.1×658 px. A transparent field still reserved 800 px even when the gallery was shorter, and the fixed 480 px stage left the arrows visually detached.
2. Fix: raised the desktop source cap to 390×844, budgeted the rendered height as `100dvh - 125px`, made the stage derive from the screen width, and made only `field.bare` intrinsic-height.
3. Post-fix evidence: `size-reference-vs-after.png` and the three responsive captures show a larger, denser left composition while the browser measurements prove the complete gallery remains visible.
4. Ordering iteration: the cycle changed from Mariosa → Zayac → Yasmina to Yasmina → Mariosa → Zayac. The primary artifact was recaptured in the current Yasmina Product `02 / 09` state; the complete forward wrap and reverse wrap pass in Playwright.

## Verification

1. Production build: passed.
2. Unit tests: 533 passed, 25 intentional skips.
3. Telegram gallery Playwright suite: 8 passed, including the new 1330×848 regression viewport.
4. Affected browser suite: 84 passed across gallery, case rows, mobile, line staleness, rail, and shell behavior.
5. Final Playwright regression after updating the line-height registry: 19 passed across the gallery and background-line staleness suites.
6. Browser-rendered QA capture: passed; Yasmina Product reached through one animated arrow click; zero console or page errors.
7. Page-weight gate: passed at 495.2 KB total and 9.6 KB compressed JavaScript.
8. `git diff --check`: passed.

final result: passed
