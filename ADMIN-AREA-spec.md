# Admin Edit Defaults Specification

**Author:** Muse Glimmer 30B (mostly)

## Objective

Provide a way to edit seasonal hour defaults used as template for new seasons
and as fallback base schedule.

## Scope

Prototype implementation in `tmp/admin-glass-proto-v2.html` and later promotion
to `src/components/OwnerHoursGlassForm.tsx`.

## Behaviour

### UI

- Button “Upravit výchozí / Edit defaults” top-right of admin page.
- Click opens glass modal overlay with:
  - Title “Výchozí otevírací doba / Default opening hours”
  - 7 weekday inputs Mon-Sun with current defaults
  - Save and Cancel buttons
- Modal is modal, backdrop click cancels.

### Data model

- Defaults stored in localStorage key `adminProtoV2.defaults` with shape:

  ```json
  {
    "mon":"9:00 - 17:00",
    "tue":"9:00 - 16:00",
    ...
    "sun":""
  }
  ```

- On first load, defaults are initialised from first season hours if no defaults
  exist.
- On Save:
  - Persist to localStorage
  - Close modal
  - Existing seasons unchanged

### Interaction with seasons

- Adding new season via `+` between seasons or after last:
  - New season start = previous.end +1 day
  - New season end = start +30 days or 23352-12-31 for last
  - Hours are pre-filled from defaults
- Edit defaults does NOT retroactively change existing seasons.

### Preview

- Preview continues to show live schedule based on seasons + exceptions.
- Defaults are not directly shown in preview.

### Validation

- Hours are free text, no format validation in prototype.
- Empty value means closed.

### i18n

- Labels bilingual CS/EN via `t` object.
- Modal title, Save/Cancel bilingual.

## Non-functional

- Prototype only, no backend.
- Persistence via localStorage.
- Glass aesthetic consistent with rest of UI.

## Acceptance criteria

- Clicking Edit defaults opens modal with pre-filled defaults.
- Changing defaults and saving updates localStorage.
- New season created via + inherits defaults.
- Modal can be cancelled without changes.
- No regressions in existing smoke tests.
