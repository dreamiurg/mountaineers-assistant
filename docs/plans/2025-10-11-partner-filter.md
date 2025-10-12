# Partner Filter Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Add a partner filter to the Insights dashboard that filters activities to show only those where ALL selected partners were present, while keeping the "Top activity partners" table unfiltered.

**Architecture:** Extend the existing filter system (activityType, category, role) with a fourth partner filter. Filter logic uses AND semantics (all selected partners must be present). Partner filter applies to all dashboard sections EXCEPT the "Top activity partners" table, which remains unfiltered to preserve context for future enhancements.

**Tech Stack:** TypeScript, React, existing ChoicesMultiSelect component, Chrome extension storage API

---

## Task 1: Add partner field to filter types

**Files:**

- Modify: `src/chrome-ext/insights/types.ts:8-12`

**Step 1: Add partner array to DashboardFilters type**

In `src/chrome-ext/insights/types.ts`, update the `DashboardFilters` interface:

```typescript
export type DashboardFilters = {
  activityType: string[];
  category: string[];
  role: string[];
  partner: string[];
};
```

**Step 2: Add partners array to filter options**

In the same file, update the `filterOptions` property in `PreparedData` interface (around line 33):

```typescript
export interface PreparedData {
  activities: PreparedActivity[];
  rosterByActivity: Map<string, RosterEntryRecord[]>;
  peopleMap: Map<string, PersonRecord>;
  currentUserUid: string | null;
  lastUpdated: Date | null;
  timelineMonths: Array<{ key: string; label: string }>;
  filterOptions: {
    activityTypes: string[];
    categories: string[];
    roles: string[];
    partners: Array<{ uid: string; name: string }>;
  };
}
```

**Step 3: Run typecheck to verify changes**

```bash
npm run typecheck
```

Expected: Should show errors in other files that need updating (hook and utils)

**Step 4: Commit type changes**

```bash
git add src/chrome-ext/insights/types.ts
git commit -m "feat: added partner field to filter types"
```

---

## Task 2: Update hook to handle partner filter

**Files:**

- Modify: `src/chrome-ext/insights/hooks/useInsightsDashboard.ts:23-27,97-101,142-157`

**Step 1: Add partner to INITIAL_FILTERS**

In `useInsightsDashboard.ts`, update `INITIAL_FILTERS` (line 23):

```typescript
const INITIAL_FILTERS: DashboardFilters = {
  activityType: [],
  category: [],
  role: [],
  partner: [],
};
```

**Step 2: Add partner to initial filterOptions state**

Update the `useState` initialization for filterOptions (line 97):

```typescript
const [filterOptions, setFilterOptions] = useState<PreparedData['filterOptions']>({
  activityTypes: [],
  categories: [],
  roles: [],
  partners: [],
});
```

**Step 3: Add partner sanitization to setFilters callback**

In the `setFilters` callback within `window.mountaineersDashboard` setup (line 142-157), add partner handling:

```typescript
setFilters: (overrides) => {
  setFilters((current) => {
    const options = filterOptionsRef.current;
    return {
      activityType: overrides.activityType
        ? sanitizeSelection(overrides.activityType, options.activityTypes)
        : current.activityType,
      category: overrides.category
        ? sanitizeSelection(overrides.category, options.categories)
        : current.category,
      role: overrides.role ? sanitizeSelection(overrides.role, options.roles) : current.role,
      partner: overrides.partner
        ? sanitizeSelection(
            overrides.partner,
            options.partners.map((p) => p.uid)
          )
        : current.partner,
    };
  });
},
```

**Step 4: Update empty state filterOptions initialization**

In the `initialize` function where filterOptions is set to empty (line 196):

```typescript
setFilterOptions({ activityTypes: [], categories: [], roles: [], partners: [] });
```

**Step 5: Run typecheck to verify changes**

```bash
npm run typecheck
```

Expected: Should pass now that hook matches types, but utils still needs updating

**Step 6: Commit hook changes**

```bash
git add src/chrome-ext/insights/hooks/useInsightsDashboard.ts
git commit -m "feat: added partner filter support to insights hook"
```

---

## Task 3: Build partner filter options from data

**Files:**

- Modify: `src/chrome-ext/insights/utils.ts` (in `prepareDashboardData` function)

**Step 1: Read the prepareDashboardData function**

```bash
# Find the function location
grep -n "export function prepareDashboardData" src/chrome-ext/insights/utils.ts
```

**Step 2: Add partner extraction logic**

Locate where `filterOptions` is being built in `prepareDashboardData` and add partner extraction. The logic should:

- Extract unique partners from `peopleMap`
- Exclude the current user (using `currentUserUid`)
- Sort alphabetically by name
- Return array of `{uid: string, name: string}`

Add this code in the filterOptions building section:

```typescript
// Extract unique partners (excluding current user)
const partners: Array<{ uid: string; name: string }> = [];
const partnerUids = new Set<string>();

peopleMap.forEach((person, uid) => {
  // Skip current user
  if (uid === currentUserUid) {
    return;
  }
  // Skip if no name
  if (!person.name || person.name.trim().length === 0) {
    return;
  }
  // Skip duplicates
  if (partnerUids.has(uid)) {
    return;
  }
  partnerUids.add(uid);
  partners.push({ uid, name: person.name });
});

// Sort alphabetically by name
partners.sort((a, b) => a.name.localeCompare(b.name));
```

Then add `partners` to the returned `filterOptions` object:

```typescript
filterOptions: {
  activityTypes,
  categories,
  roles,
  partners,
},
```

**Step 3: Run typecheck to verify changes**

```bash
npm run typecheck
```

Expected: Should pass now that filterOptions includes partners

**Step 4: Commit partner options extraction**

```bash
git add src/chrome-ext/insights/utils.ts
git commit -m "feat: extracted partner filter options from activity data"
```

---

## Task 4: Implement partner filtering logic

**Files:**

- Modify: `src/chrome-ext/insights/utils.ts` (in `calculateDashboard` function)

**Step 1: Read the calculateDashboard function**

```bash
# Find the function location
grep -n "export function calculateDashboard" src/chrome-ext/insights/utils.ts
```

**Step 2: Add partner filtering after existing filters**

Locate where activities are being filtered (after activityType, category, role filters). Add partner filtering logic:

```typescript
// Apply partner filter (AND logic: all selected partners must be present)
if (filters.partner.length > 0) {
  filtered = filtered.filter((activity) => {
    const roster = baseData.rosterByActivity.get(activity.uid);
    if (!roster || roster.length === 0) {
      return false; // No roster data means no partners
    }

    const activityPartnerUids = new Set(roster.map((entry) => entry.person_uid));

    // Check if ALL selected partners are present in this activity
    return filters.partner.every((partnerUid) => activityPartnerUids.has(partnerUid));
  });
}
```

**Step 3: Ensure partners table uses unfiltered data**

Find where the partners table data is calculated. Verify it uses `baseData.activities` (unfiltered) rather than `filtered` activities. If it's using filtered activities, change it to use the base data directly.

Look for a section that calculates partner statistics and ensure it references `baseData.activities`:

```typescript
// Partners table calculation (uses unfiltered base data)
const partnersMap = new Map<string, { count: number; lastDate: Date | null }>();

baseData.activities.forEach((activity) => {
  // ... existing partner counting logic using baseData.activities
});
```

**Step 4: Run typecheck to verify changes**

```bash
npm run typecheck
```

Expected: Should pass with no errors

**Step 5: Commit partner filtering logic**

```bash
git add src/chrome-ext/insights/utils.ts
git commit -m "feat: implemented partner filter with AND logic"
```

---

## Task 5: Add partner filter UI component

**Files:**

- Modify: `src/chrome-ext/insights/InsightsApp.tsx:373,383-405`

**Step 1: Update filter grid layout**

Change the grid from 3 columns to 4 columns (line 373):

```typescript
<form className="grid grid-cols-1 gap-4 md:grid-cols-4">
```

**Step 2: Add partner filter ChoicesMultiSelect**

After the role filter ChoicesMultiSelect (after line 404), add the partner filter:

```typescript
<ChoicesMultiSelect
  id="filter-partner"
  label="Activity partner"
  options={filterOptions.partners.map((p) => p.uid)}
  value={filters.partner}
  onChange={(values) => setFilter('partner', values)}
  disabled={filterDisabled || filterOptions.partners.length === 0}
  helperText={
    filterOptions.partners.length === 0
      ? 'Partner filter available once roster data is known.'
      : undefined
  }
  formatter={(uid) => {
    const partner = filterOptions.partners.find((p) => p.uid === uid);
    return partner?.name ?? uid;
  }}
/>
```

**Step 3: Run typecheck to verify changes**

```bash
npm run typecheck
```

Expected: Should pass with no errors

**Step 4: Build the extension to test**

```bash
npm run build
```

Expected: Should build successfully

**Step 5: Commit UI changes**

```bash
git add src/chrome-ext/insights/InsightsApp.tsx
git commit -m "feat: added partner filter UI to insights dashboard"
```

---

## Task 6: Update summary text to mention partner filtering

**Files:**

- Modify: `src/chrome-ext/insights/utils.ts` (in `buildSummary` function)

**Step 1: Find the buildSummary function**

```bash
grep -n "export function buildSummary" src/chrome-ext/insights/utils.ts
```

**Step 2: Add partner filter acknowledgment**

Locate where the summary mentions active filters. Add logic to include partner filter information:

```typescript
// Inside buildSummary function, where filters are being described
const filterParts: string[] = [];

// ... existing activityType, category, role filter text ...

// Add partner filter text
if (view.metrics.totalActivities > 0 && /* partner filter is active */) {
  const partnerNames = /* get partner names from filter */;
  if (partnerNames.length === 1) {
    filterParts.push(`activities with ${partnerNames[0]}`);
  } else if (partnerNames.length === 2) {
    filterParts.push(`activities with ${partnerNames[0]} and ${partnerNames[1]}`);
  } else if (partnerNames.length > 2) {
    const first = partnerNames.slice(0, -1).join(', ');
    const last = partnerNames[partnerNames.length - 1];
    filterParts.push(`activities with ${first}, and ${last}`);
  }
}
```

Note: The exact implementation depends on how buildSummary currently receives filter context. You may need to pass additional parameters or access baseData to map UIDs to names.

**Step 3: Run typecheck to verify changes**

```bash
npm run typecheck
```

Expected: Should pass with no errors

**Step 4: Build and test the summary text**

```bash
npm run build
```

**Step 5: Commit summary text enhancement**

```bash
git add src/chrome-ext/insights/utils.ts
git commit -m "feat: updated summary to acknowledge partner filtering"
```

---

## Task 7: Manual testing and validation

**Files:**

- Test with: Chrome extension in `dist/`

**Step 1: Load unpacked extension**

1. Build the extension: `npm run build`
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the `dist/` directory
5. Open the Insights page

**Step 2: Test partner filter functionality**

- [ ] Partner filter dropdown appears in filters section
- [ ] Partners are listed alphabetically
- [ ] Selecting one partner filters activities correctly
- [ ] Selecting multiple partners uses AND logic (only shows activities with ALL selected partners)
- [ ] Top activity partners table remains unfiltered
- [ ] Timeline chart updates based on filter
- [ ] Activity mix chart updates based on filter
- [ ] Roles chart updates based on filter
- [ ] Recent activities table updates based on filter
- [ ] Metrics update based on filter
- [ ] Summary text mentions selected partners
- [ ] "Clear filters" button clears partner filter
- [ ] Grid layout looks correct with 4 filters on desktop

**Step 3: Test edge cases**

- [ ] Filter with no partners selected (should show all)
- [ ] Filter with partner that appears in no activities (should show empty)
- [ ] Filter combined with activity type, category, and role filters
- [ ] Large number of partners (scrolling in dropdown)
- [ ] Partners with no roster data

**Step 4: Document any issues found**

Create a file `docs/plans/2025-10-11-partner-filter-test-results.md` with findings.

**Step 5: Fix any issues discovered**

Address issues and commit fixes with descriptive messages.

---

## Task 8: Update Storybook stories (if applicable)

**Files:**

- Check: `src/chrome-ext/insights/InsightsApp.stories.tsx`

**Step 1: Read the stories file**

Check if InsightsApp has Storybook stories and if they mock filter data.

**Step 2: Add partner mock data to stories**

If stories exist, add mock partner data to the filterOptions:

```typescript
partners: [
  { uid: 'partner-1', name: 'Alice Smith' },
  { uid: 'partner-2', name: 'Bob Jones' },
  { uid: 'partner-3', name: 'Charlie Brown' },
],
```

**Step 3: Test in Storybook**

```bash
npm run storybook
```

Navigate to InsightsApp story and verify partner filter appears and functions.

**Step 4: Commit Storybook changes**

```bash
git add src/chrome-ext/insights/InsightsApp.stories.tsx
git commit -m "feat: added partner filter mock data to Storybook"
```

---

## Task 9: Run quality gates

**Files:**

- All modified files

**Step 1: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors

**Step 2: Run formatting**

```bash
npm run format
```

Expected: All files formatted

**Step 3: Run pre-commit hooks**

```bash
uv run pre-commit run --all-files
```

Expected: All hooks pass

**Step 4: Commit any formatting changes**

```bash
git add -A
git commit -m "chore: applied formatting and linting fixes"
```

---

## Task 10: Final review and documentation

**Files:**

- Create: `docs/features/partner-filter.md` (optional)
- Review: All commits

**Step 1: Review git log**

```bash
git log main..HEAD --oneline
```

Verify all commits follow the project's commit message style.

**Step 2: Test full build**

```bash
npm run build
```

Expected: Clean build with no errors

**Step 3: Document the feature (optional)**

If the project maintains feature documentation, create a brief doc explaining:

- What the partner filter does
- How it works (AND logic)
- Why partners table stays unfiltered

**Step 4: Prepare for PR or merge**

Feature is ready for code review, PR creation, or merge to main branch.

---

## Success Criteria

- [ ] Partner filter appears in Insights dashboard filters section
- [ ] Partners listed alphabetically by name
- [ ] Multiple partner selection uses AND logic
- [ ] All dashboard sections filter correctly EXCEPT "Top activity partners" table
- [ ] Summary text acknowledges partner filtering
- [ ] TypeScript compiles with no errors
- [ ] Code follows project formatting standards
- [ ] Pre-commit hooks pass
- [ ] Extension builds successfully
- [ ] Manual testing confirms expected behavior
