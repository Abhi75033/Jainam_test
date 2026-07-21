# Changelog — JiNANAM Client Corrections

All client corrections have been successfully implemented across the Node.js/Express backend and React admin panel.

## [1.0.0] - 2026-07-21

### Added
- **Global Reusable Components**:
  - `TimePicker.jsx`: Clock-based time picker formatting.
  - `MemberLinkSelect.jsx`: Searchable member selection dropdown.
  - `CountryDropdown.jsx`: Country dropdown defaulting to India.
  - `CurrencySelect.jsx`: Currency select defaulting to INR ₹.
  - `BankingDetailsForm.jsx`: Shared bank details form with 80G/CSR options.
  - `AddressBlock.jsx`: Reusable standardized address block.
- **Journey Logs & Tracking**:
  - Added "Log Event" button and modal inside `TrackingPage.jsx` using `TimePicker`.
- **Ads Pricing & Calculator**:
  - Added pricing calculator, select controls, rates, and cost tracking.
- **Audit Logs visual diff viewer**:
  - Added side-by-side comparative table showing only changed fields in red/green tint.
- **Security Login Lockouts**:
  - Added 5 failed attempts lockout logic (15 minutes duration) for password-based logins.

### Fixed
- **B1**: Removed hard Super Admin gate from `PATCH /members/:publicId` route.
- **B2**: Resolved React runtime error/blackout in "Health & Professional" tab rendering.
- **B3**: Fixed Dharamshala creation/edit foreign key constraint bug on `mulNayakBhagwanId`.
- **B4**: Corrected Notices payload validation matching backend schemas.
- **B5**: Fixed Subscription Plans creation routes.
- **B6**: Fixed Non-Jain Members lists filtering to exclude Jain data.
- **B7**: Filtered Staff accounts from the Trustee member-linking dropdown queries.
- **B8**: Configured auto-created inactive members with "Pending First Login" status.
- **B9**: Added the Family tab during new Member registration.
- **Sidebar runtime exception**: Fixed `ReferenceError: ChevronRight is not defined` by importing the icon from `lucide-react`.
