# JeevanGrid User Roles and Features

This document enumerates all user roles in the JeevanGrid platform and their associated features/permissions. The platform supports 6 distinct roles, each with different capabilities and access levels.

---

## 1. CITIZEN (citizen@demo.com)
**Primary Role:** Report emergency incidents and receive official warnings

### Features Available:
- **Emergency Report Submission:** Create incident reports with location, description, photos, and vulnerable persons info
- **Voice Report:** Speech-to-text transcription with AI extraction
- **Acknowledgement:** Record response to official warnings (I have seen this / I am safe / Need assistance / Cannot evacuate / Need more info)
- **Alert Acknowledgment:** Record response to official warnings via 5 response options
- **Community Reports:** Submit ground reports that contribute to community intelligence
- **Weather/AQI Info:** View current weather and air quality for their location
- **Risk Assessment:** View exposure estimates for their area
- **Resource Access:** View emergency resources and guides
- **Push Notifications:** Receive official warning relays (marked as "relayed by JeevanGrid")

### Limitations:
- Reports start as **UNVERIFIED** — submission does not dispatch a team
- Cannot verify incidents or declare roads safe
- Cannot auto-dispatch teams
- Acknowledgement does not equal verified incident

### Demo Credentials:
- Email: `citizen@demo.com`
- Password: `Password123!`

---

## 2. DISTRICT OFFICER (district@demo.com)
**Primary Role:** Oversee district-level operations, triage incidents, and manage resources

### Features Available:
- **All Citizen Features** plus:
- **Incident Triage:** View and manage incident reports
- **Incident Assignment:** Assign field responders to incidents
- **Status Updates:** Update incident status (NEW → ASSIGNED → IN_PROGRESS → RESOLVED)
- **Official Alerts:** View and stage official warnings (creates internal operational records)
- **Playbook Activation:** Activate playbook templates for disaster response
- **Playbook Tasks:** Manage task completion with evidence recording
- **Acknowledgement Management:** View and convert acknowledgements to incidents
- **Satellite Layer Import:** Import and view satellite product layers
- **Community Intelligence:** View community reports, verify/corroborate/reject
- **District Summary Metrics:** View exposure summaries, assessment counts
- **Shelter Management:** View shelter capacity and occupancy
- **Hospital Bed Management:** View available beds and ICU capacity

### Limitations:
- Playbooks are **internal preparedness checklists** — do not issue warnings or dispatch teams
- Only human officers can verify incidents and communicate evacuations
- Satellite import is manual prototype — no automatic flood/damage detection

### Demo Credentials:
- Email: `district@demo.com`
- Password: `Password123!`

---

## 3. STATE EOC (state@demo.com)
**Primary Role:** State-level emergency operations center oversight

### Features Available:
- **All District Officer Features** plus:
- **Multi-District Overview:** View status across all districts
- **State-Level Playbooks:** Activate state-level playbooks
- **State Summary Metrics:** View overall state statistics
- **Cross-District Resource Sharing:** Coordinate resources between districts
- **State-Level Acknowledgement:** View district-level acknowledgements
- **Simulation Scenarios:** Load labelled SIMULATION data for training

### Limitations:
- Same playbook disclaimer as district officer
- Simulation data is explicitly labelled and not real

### Demo Credentials:
- Email: `state@demo.com`
- Password: `Password123!`

---

## 4. HEALTH OFFICER (health@demo.com)
**Primary Role:** Health-specific monitoring and resource tracking

### Features Available:
- **Citizen Basic Features**
- **Hospital/Occupancy Tracking:** View hospital beds, ICU availability, shelter capacity
- **Health-Specific Dashboards:** View health-related metrics
- **Health Alerts:** Receive health-specific warnings (if configured)
- **Resource Allocation:** Track medical supplies and equipment

### Limitations:
- Limited to health-specific data view
- Cannot verify incidents or dispatch teams
- Playbook disclaimer still applies

### Demo Credentials:
- Email: `health@demo.com`
- Password: `Password123!`

---

## 5. FIELD RESPONDER (responder@demo.com)
**Primary Role:** Field-level response and coordination

### Features Available:
- **Citizen Basic Features**
- **Incident Assignment:** Receive assigned incidents from officers
- **Field Report Submission:** Log field reports with situation reports
- **Casualty Tracking:** Track rescued civilians per incident
- **Nearby Facility Location:** View nearby hospitals and shelters
- **Risk Assessment:** View local risk assessments
- **Nearby Help:** View nearby help locations and contacts

### Limitations:
- Cannot create new incidents (only receive assigned ones)
- Cannot verify or stage official alerts
- Limited to assigned incidents only
- Playbook tasks limited to own role scope

### Demo Credentials:
- Email: `responder@demo.com`
- Password: `Password123!`

---

## 6. COMMUNITY VOLUNTEER (volunteer@demo.com)
**Primary Role:** Community-level reporting and assistance

### Features Available:
- **Citizen Basic Features**
- **Ground Report Submission:** Submit community reports (not verified incidents)
- **Corroboration:** Corroborate other community reports (does not set OFFICER_VERIFIED)
- **View Community Metrics:** View summary statistics
- **Category-Based Viewing:** View reports by category
- **Basic Risk Information:** View general risk information

### Limitations:
- **Cannot verify incidents** — only set CORROBORATED status with 2 independent corroborations
- **Cannot set OFFICER_VERIFIED** — only officers can do this
- **Cannot dispatch teams** — ever
- **PII masking:** Phone numbers and exact locations are masked for volunteer view
- **Report visibility:** Only see reports relevant to their role

### Demo Credentials:
- Email: `volunteer@demo.com`
- Password: `Password123!`

---

## Role Hierarchy and Access Control

| Role | Can Verify | Can Dispatch | Can Stage Alerts | Can Activate Playbooks | Can Import Satellite |
|------|-----------|-------------|------------------|----------------------|---------------------|
| CITIZEN | No | No | No | No | No |
| DISTRICT_OFFICER | Yes (own incidents) | No (advisory only) | Yes | Yes | Yes |
| STATE_EOC | Yes (all incidents) | No (advisory only) | Yes | Yes | Yes |
| HEALTH_OFFICER | No | No | No | Limited | No |
| FIELD_RESPONDER | No | No | No | Limited (own role) | No |
| COMMUNITY_VOLUNTEER | No | No | No | No | No |

---

## Demo Account Credentials Summary

| Role | Email | Password |
|------|-------|----------|
| CITIZEN | citizen@demo.com | Password123! |
| DISTRICT_OFFICER | district@demo.com | Password123! |
| STATE_EOC | state@demo.com | Password123! |
| HEALTH_OFFICER | health@demo.com | Password123! |
| FIELD_RESPONDER | responder@demo.com | Password123! |
| COMMUNITY_VOLUNTEER | volunteer@demo.com | Password123! |

---

## Key Platform-Wide Rules (All Roles)

1. **No Auto-Dispatch:** No role can auto-dispatch teams or declare roads safe
2. **Acknowledgement ≠ Verification:** Recording an acknowledgement does not verify an incident
3. **Playbooks are Advisory:** Playbooks are internal preparedness checklists, not government orders
4. **AI is Advisory:** AI outputs never set OFFICER_VERIFIED or dispatch teams
5. **Fail-Closed Gate:** Unverifiable data is excluded, never invented
6. **Simulation Labelling:** Demo/simulation data is explicitly labelled "SIMULATION" and never presented as real

---

## Authentication

- **Login URL:** `/login` (or `/` with redirect)
- **Demo Password:** `Password123!` (for all roles)
- **Token Storage:** JWT stored in `localStorage` as `jeevangrid_token`
- **Session Persistence:** Token persists across sessions until logout
- **Logout:** Clears token and user session

---

## Getting Started

1. **Login** with demo credentials above
2. **Select your role** — the dashboard will display role-appropriate features
3. **Explore** the available features for your role
4. **Use** the help/guide sections for each disaster type
5. **Submit** reports or acknowledgements as appropriate for your role

---
*This document was generated from the JeevanGrid platform codebase. All features and permissions are subject to the platform's RBAC (Role-Based Access Control) system and may be updated as the platform evolves.*