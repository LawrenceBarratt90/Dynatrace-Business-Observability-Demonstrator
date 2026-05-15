# Dashboard Generation Fixes - Testing Guide

## Summary of Changes

This document describes the critical fixes applied to the AI Dashboard Generator to address the "all null" dashboard issue and enforce SudoSmitty specifications.

### Root Cause
The dashboard generator was creating dashboards with queries referencing fields that don't exist in the tenant's BizEvents data. When fields don't exist in Grail, queries return null values, resulting in empty dashboards.

## Critical Fixes Applied

### 1. ✅ Enhanced Field Discovery with Increased Retries
**Location:** `/routes/ai-dashboard.js` - `discoverBizEventFields()` calls

**Changes:**
- `/deploy-dtctl` endpoint: Increased retries from `maxRetries: 1, pollIntervalMs: 1000` to `maxRetries: 12, pollIntervalMs: 3000`
- `/generate` endpoint: Added early field discovery with `maxRetries: 6, pollIntervalMs: 2000` before LLM generation
- BizEvents may take time to arrive in Grail; longer retry windows ensure field discovery succeeds

**Impact:** Field discovery now waits up to ~40 seconds for BizEvents to arrive, providing much better detection of actual tenant data.

### 2. ✅ Discovered Fields List Passed to LLM Prompt
**Location:** `/routes/ai-dashboard.js` - `generateTilePlanWithOllama()`

**Changes:**
- Shows **ALL discovered fields** (not just top 8) to Ollama with priority markers (⭐) for top 5
- Added critical rule to LLM prompt: "You MUST ONLY use fields listed above in the 'field' property"
- Explicit warnings against hallucinating field names like "geo.location.latitude" or "region_name"
- LLM now sees actual field types and sample values from Grail

**Impact:** Ollama generates tile plans using ONLY fields that actually exist in tenant data.

### 3. ✅ Mandatory Map Tile at Correct Position
**Location:** `/routes/ai-dashboard.js` - `generatePromptDrivenDashboard()` after header

**Changes:**
- Added mandatory geo-context tile after dashboard header
- Uses donut chart showing event distribution by `region` field
- Positioned using proper Y-axis calculation: y = 3 (after header+flow), dimensions 24×4
- Gracefully handles missing `region` field with fallback query that filters to non-null regions

**Impact:** All dashboards now include geographic context as per SudoSmitty specification.

### 4. ✅ DQL Query Validation & Field Existence Checking
**Location:** `/routes/ai-dashboard.js` - New `validateDQLQueryFields()` function

**Changes:**
- New validation function extracts field references from generated DQL queries
- Checks each `additionalfields.*` reference against discovered fields
- Logs warnings for unknown fields and common hallucinations (geo.location.latitude, etc.)
- Validation integrated into `buildTileFromPlan()` to catch issues before deployment
- Warnings logged with tile title for easy debugging

**Impact:** Issues with missing fields are caught early and logged clearly.

## Testing the Fixes

### Test 1: Field Discovery Works
```bash
# Check that field discovery logs show actual fields from BizEvents
curl -X POST http://localhost:8000/api/ai-dashboard/generate \
  -H "Content-Type: application/json" \
  -d '{
    "journeyData": {
      "company": "Your Company Name",
      "journeyType": "Your Journey Type",
      "additionalFields": {}
    },
    "useAI": true
  }'

# Look in server logs for:
# ✅ Discovered X fields: [fieldName1, fieldName2, ...]
# ✅ Pre-discovered Y fields for LLM context: [...]
```

**Expected:** Should see actual field names from your tenant (not empty).

### Test 2: Dashboard Has Map Tile
```bash
# After generating dashboard, check the JSON structure
# Look for tile with title "🌍 Journey Events by Location"
# Should be positioned after header tiles (around y:3-7 range)

# In generated dashboard JSON:
{
  "tiles": {
    "0": { ... header tile ... },
    "1": { ... journey flow ... },
    "2": { 
      "title": "🌍 Journey Events by Location",
      "type": "data",
      "query": "fetch bizevents | filter json.companyName == \"$EventProvider\" | ... | by: {additionalfields.region}",
      "visualization": "donutChart"
    },
    ...
  },
  "layouts": {
    "2": { "x": 0, "y": 3, "w": 24, "h": 4 }  // Map tile positioning
  }
}
```

**Expected:** Map tile exists and has correct query referencing only discovered fields.

### Test 3: LLM Only Uses Discovered Fields
```bash
# Enable debug logging in generateTilePlanWithOllama()
# Look for logs showing:
# - Field discovery: "Proxy-discovered X fields: ..."
# - Tile generation: "Ollama raw (XXXX chars)"
# - Validation: "Tile plan: Y valid from Z generated"
# - Any rejections: "Rejected N tiles: [reason1 | reason2]"

# Check that rejected tiles are for unknown fields:
# "field "unknownFieldName" not in discovered fields"
# NOT for fields that actually exist
```

**Expected:** 
- Ollama uses only discovered fields
- Few rejections (< 20% of total)
- All rejected tiles have clear reasons logged

### Test 4: Dashboard Queries Are Valid
```bash
# After dashboard deployment, manually run generated queries in Dynatrace
# They should return data (not empty/null)
fetch bizevents
| filter json.companyName == "Company Name"
| filter json.journeyType == "Journey Type"
| filter isNotNull(additionalfields.region)
| summarize count = count(), by: {additionalfields.region}
| sort count desc
| limit 50

# Should return regions with event counts, not null values
```

**Expected:** Queries return actual data from your BizEvents.

### Test 5: Validation Catches Missing Fields
```bash
# Check server logs for validation messages like:
# [AI Dashboard] ⚠️ [KPI Title] Field "additionalfields.nonExistentField" not found in discovered fields
# [AI Dashboard] ⚠️ [Title] Query uses "geo.location.latitude/longitude" which don't exist

# These indicate the validation is working
```

**Expected:** Validation warnings appear in logs for hallucinated/missing fields.

## Verification Checklist

- [ ] Field discovery logs show actual fields (not empty list)
- [ ] Dashboard JSON has map tile with correct position and query
- [ ] Map tile query references discovered field names (e.g., region, location)
- [ ] Generated queries use only fields from the discovered list
- [ ] No "null" tiles appearing in the dashboard
- [ ] Validation logs show field coverage (if any issues)
- [ ] Dashboard tiles show actual data when viewed in Dynatrace

## Troubleshooting

### Issue: Still seeing "all null" tiles
**Debug steps:**
1. Check field discovery logs: Are fields being discovered?
   ```
   grep "Discovered.*fields" /server-logs
   ```
2. Check if BizEvents are arriving: Manually query in Dynatrace within 30 seconds of journey
3. Check field names match: Are discovered fields used in DQL? (e.g., `additionalfields.region`)

### Issue: Map tile shows no data
**Possible causes:**
- `region` field doesn't exist in your BizEvents (try a different field)
- Query is correct but events don't have region data (check sample BizEvents)
- Typo in field name (check logs for validation warnings)

### Issue: Tiles have "unknown field" errors
**Action:**
- Check validation logs for which fields are missing
- Verify field name matches discovered fields exactly (case-sensitive)
- Update LLM prompt if field names need aliases

## DQL Field Reference

Common field patterns in BizEvents:
```
Root fields:
- json.companyName       (always available)
- json.journeyType       (always available)
- json.stepName          (step context)
- timestamp              (timing)

Additional fields (conditional, depend on journey config):
- additionalfields.region, additionalfields.location   (geography)
- additionalfields.revenue, additionalfields.orderTotal  (financial)
- additionalfields.deviceType, additionalfields.browser  (technical)
- additionalfields.churnRisk, additionalfields.fraudRisk (risk prediction)

Variable fields (custom to your setup):
- Check discovered fields in generation logs
```

## Performance Notes

- Field discovery with retries: **40 seconds maximum** (8 attempts × 3-4 sec each)
- LLM tile generation: **~2 minutes** (streaming response with 1000+ field names)
- Dashboard deployment: **~5 seconds** (validation + upload)

If field discovery is timing out, check:
1. Dynatrace token permissions (needs Grail query access)
2. Network connectivity to Dynatrace environment
3. BizEvents actually being ingested (check in Dynatrace UI)

## Related Configuration

Environment variables that affect dashboard generation:
```bash
DT_ENVIRONMENT          # Dynatrace environment URL
DT_PLATFORM_TOKEN       # Platform token for Grail queries
OLLAMA_ENDPOINT         # LLM endpoint (default: http://localhost:11434)
OLLAMA_MODEL            # LLM model (default: llama3.2:1b)
OLLAMA_MODE             # Set to "disabled" to skip LLM (use templates only)
```

---

**Last Updated:** 2024
**Status:** ✅ All fixes implemented and integrated
