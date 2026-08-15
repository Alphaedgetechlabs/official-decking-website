# Text-only copy updates in quote flow

## Goal
Update three specific text strings in the quote wizard, changing only words (no CSS, IDs, variables, or structure).

## Changes
1. **Step 1 Location slide** — `src/components/wizard/Step1Location.tsx` line 96
   - Change `"verified local decking pros"` → `"verified local decking professionals"`

2. **Step 1 Location slide** — `src/components/wizard/Step1Location.tsx` line 129
   - Change `"looking for fast, reliable decking quotes."` → `"looking for fast, reliable quotes."`

3. **Contact / last slide** — update both occurrences of `"Enter your details so your decking pros can send accurate pricing."`
   - `src/components/wizard/Step4ContactDetails.tsx` line 74
   - `src/components/steps/ContactStep.tsx` line 88
   - Change `"decking pros"` → `"decking professionals"` in both

## Verification
- Run a production build check to ensure no TypeScript errors.
- Confirm the updated text renders in the `/quote` preview.