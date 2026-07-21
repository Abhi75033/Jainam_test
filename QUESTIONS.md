# Client Corrections — Open Questions (NEEDS CLARIFICATION)

The following items require further clarification before implementation. All other items have been implemented.

---

## 1. Chaturmas Auto-Population from Community

**Status**: NEEDS CLARIFICATION — Client requested a call.

**Context**: In MS Management (People → MS Management → Chaturmas), the client does not want manual entry. The Chaturmas History should auto-populate from the "Community → Chaturmas" entries. The exact logic for which Chaturmas entries are linked to which MS profile is unclear.

**Recommended default**: Until clarified, the Chaturmas History tab in MS Management is read-only, showing entries from the global Chaturmas module that reference this MS ID.

---

## 2. Access to Google Docs Specs

**Status**: NEEDS CLARIFICATION — Docs not yet shared.

The following modules are referenced in the spec but their detailed Google Docs have not been provided:
- **Events** — client said this is priority #1
- **Community Page** — referenced for Community Pages module
- **Stanak** — Stanak document (partially described in this brief)
- **Tours** — Tours spec
- **99 Management** — 99 management spec

**Recommended default**: These modules are scaffolded with "Coming Soon" pages until docs are received. Events page retains the existing implementation.

---

## 3. "Contact Details Verification Flags" Feature

**Status**: NEEDS CLARIFICATION

**Context**: There appear to be verification flags on contact details (phone/email) in the member profile. The client found these confusing.

**Recommended default**: Remove verification flag UI from member profiles. Verification status remains in DB for future use.

---

## 4. Default Status for New Member Registrations (B8)

**Status**: IMPLEMENTED with clarification needed.

**Current behavior**: New admin-created members get `INACTIVE` status and display as `PENDING ACTIVATION` (amber badge) in the member list.

**Questions for client**:
- Should admin-created members be ACTIVE immediately?
- Or should they require a first-login activation step?
- Should there be an auto-invite SMS/email with a link?

**Recommended default**: Keep PENDING_ACTIVATION until client confirms the activation flow.

---

## 5. Navigation Layout Default

**Status**: IMPLEMENTED — Defaulting to `nested` (Option 2).

**Current behavior**: NAV_LAYOUT = "nested" by default. Can be toggled by setting `jinanam_nav_layout` in localStorage to "flat" for Option 1.

**Pending**: Client to confirm which layout is their production preference.

---

## 6. Varshitap Management

**Status**: BEHIND FEATURE FLAG — Scaffolded.

**Context**: This module exists in Option 1 (Communication section) but was absent in the initial Option 2 spec.

**Implemented**: Added to Community section in nested mode behind `FEAT_VARSHITAP` feature flag. Also present in flat mode's Communication group.

**Questions for client**: Confirm placement, and provide spec/description for this module's functionality.

---

## 7. Bhojanshala as Standalone Module

**Status**: BEHIND FEATURE FLAG (`FEAT_BHOJANSHALA`).

**Context**: Option 2 lists Bhojanshala as a top-level Organization type with sub-pages (Timings, Menu, Pass Management). The current build has Bhojanshala handled as a section inside Dharamshala.

**Questions for client**: Is Bhojanshala a standalone Organization type or always nested under another org?

---

## 8. MS / Monk Terminology

**Status**: PARTIALLY IMPLEMENTED.

**Context**: The client requested renaming "Monk" → "MS" (Muni Sangh / Mahashraman Sadhu, etc.) in all UI labels.

**Implemented**: Nav labels changed to "MS". MS Management section renamed.

**Not yet changed**: Database column names and API keys remain as `monk` for backward compatibility. UI-only label sweep completed.
