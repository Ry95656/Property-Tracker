# Property Ledger

A landlord's rent, repair, complaint, and appointment tracker styled as a paper ledger book.

## Setup

```bash
npm install
npm run dev
```

Then open the printed local URL in your browser.

## Build for production

```bash
npm run build
npm run preview
```

## Notes

- Data (properties, tenants, repairs, complaints, appointments, and repair
  photos) is saved to the browser's `localStorage`, scoped to whatever
  origin you deploy this on. Clearing site data will reset it.
- Repair photos are compressed client-side before saving, but `localStorage`
  has a ~5-10MB total limit per origin, so very large photo libraries may
  eventually hit that ceiling. For heavier use, swap `src/storage.js` for a
  real backend (e.g. a small API + database, or a service like Supabase).
