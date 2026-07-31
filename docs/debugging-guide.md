# Comprehensive Application Debugging Guide

This guide provides a step-by-step methodology for developers, QA engineers, and support personnel to debug, diagnose, and resolve issues across the **Service Center Management System (ServiceHub)**.

---

## 1. System Architecture Quick Reference

Before debugging, understand how data flows through the application:

```
[ Browser / UI ] ────( HTTP / JSON )────► [ Django REST API ] ────► [ PostgreSQL DB ]
   Next.js (React)                           Render Backend             App Database
   frontend/src/app/                         Backend/                   Backend/*/models.py
```

### URL to Code Mapping Matrix

| What You See / Access | Layer | Code File Location |
| :--- | :--- | :--- |
| Browser Page `/jobs` | Frontend Page | `frontend/src/app/jobs/page.tsx` |
| Browser Page `/billing/[id]` | Frontend Page | `frontend/src/app/billing/[id]/page.tsx` |
| Browser Page `/outsourcing` | Frontend Page | `frontend/src/app/outsourcing/page.tsx` |
| Navigation Sidebar | Frontend Component | `frontend/src/components/layout/Layout.tsx` |
| Frontend API Functions | Frontend Services | `frontend/src/lib/api/services.ts` |
| API URL `/api/jobs/` | Backend Endpoint | `Backend/jobs/urls.py` ➔ `JobCardViewSet` |
| API URL `/api/billing/invoices/` | Backend Endpoint | `Backend/billing/urls.py` ➔ `InvoiceViewSet` |
| Business Logic & Query Filters | Backend View | `Backend/jobs/views.py` |
| Field Formatting & Validation | Backend Serializer | `Backend/jobs/serializers.py` |
| Database Schema & Models | Backend Models | `Backend/jobs/models.py` |

---

## 2. Step-by-Step Debugging Workflow

Whenever a bug, blank data, or error occurs, follow these 4 steps sequentially:

```
Step 1: DevTools (Network & Console) ➔ Step 2: Identify Payload vs UI ➔ Step 3: Trace Backend ➔ Step 4: Fix & Verify
```

---

### Step 1: Open Browser Developer Tools (DevTools)

1. Open the application in Google Chrome or Edge.
2. Press **`F12`** (or `Right Click` ➔ **Inspect**).
3. Open two key tabs:
   - **Console Tab**: Displays JavaScript exceptions, unhandled promises, and React render errors.
   - **Network Tab**: Displays all API HTTP calls between frontend and backend.

---

### Step 2: Inspecting the Network Tab (The Gold Standard)

1. In the DevTools **Network** tab, click **`Fetch/XHR`** on the filter bar.
2. Perform the action that causes the issue (e.g. open page, click filter, or submit form).
3. Click on the corresponding request in the left request list (e.g. `jobs/?branch=...`).
4. Inspect the 4 sub-tabs:

#### A. `Headers` Tab
- **Request URL**: Verify the exact backend endpoint requested.
- **Request Method**: Verify `GET`, `POST`, `PUT`, `PATCH`, or `DELETE`.
- **Status Code**: Check status (e.g. `200 OK`, `400 Bad Request`, `403 Forbidden`, `500 Server Error`).
- **Request Headers**: Verify `Authorization: Bearer <token>` and `X-Branch-ID: <branch-uuid>`.

#### B. `Payload` / `Params` Tab
- Shows exact data sent to backend in query string or JSON request body.

#### C. `Response` / `Preview` Tab (CRITICAL)
- Shows raw JSON returned by backend API.
- **If HTTP 200 OK but data is blank in UI**: Expand `results[0]` in Response tab.
  - If field is missing or `null` in JSON ➔ Data is missing in DB or not serialized in Backend.
  - If field is present in JSON ➔ Issue is in Frontend React UI rendering.
- **If HTTP 400 Bad Request**: Expand `error` object.
  - Inspect `error.fields` (e.g. `{ assigned_technician: ["Select a valid choice..."] }`).

---

### Step 3: Diagnosing HTTP Status Codes

| Status Code | Meaning | Cause | How to Solve |
| :--- | :--- | :--- | :--- |
| **`200 OK`** | Success | Request succeeded. If page looks empty, check `Response` tab to see if data array is empty (`results: []`). | Adjust filters or verify database records exist. |
| **`400 Bad Request`** | Validation Error | Backend rejected input parameter (e.g. choice validation or missing required field). | Inspect `Response` tab `error.fields`. Update Backend `FilterSet` or Serializer to accept parameter. |
| **`401 Unauthorized`** | Authentication Failed | Token expired, invalid, or missing header. | Log out and log back in to refresh JWT token in `localStorage`. |
| **`403 Forbidden`** | Permission Denied | Logged-in user role lacks permission for action (RBAC). | Check `ROLE_PERMISSIONS` in `frontend/src/types/index.ts` or user role in DB. |
| **`404 Not Found`** | Not Found | URL typo or requested object ID does not exist in DB. | Check `urls.py` or verify UUID in database. |
| **`500 Internal Error`** | Backend Crash | Python exception crashed DRF backend server. | Check Render backend logs or Django traceback log. |

---

### Step 4: Tracing Code End-to-End (Worked Example)

#### Problem Scenario: "COMPLAINT column is empty on Job Cards table"

1. **Inspect Network Response**:
   - Open Network tab ➔ Click `jobs/?branch=...` ➔ Click **Preview**.
   - Check `results[0].customer_complaint`.
   - Result: `customer_complaint` is `""` or `null` on legacy records.

2. **Locate Frontend Code**:
   - Open `frontend/src/app/jobs/page.tsx`.
   - Search for `COMPLAINT` header or table column `<td>`:
     ```tsx
     <td className="max-w-[200px] px-4 py-2.5 align-middle">
       <span className="line-clamp-1 text-neutral-600 dark:text-slate-400">
         {job.customer_complaint}
       </span>
     </td>
     ```

3. **Apply Resilient Fallback Fix**:
   - Create helper `formatComplaintText(complaint, fallbackComments)` that safely parses JSON strings and falls back to `additional_comments` or `"—"`:
     ```tsx
     {formatComplaintText(job.customer_complaint, job.additional_comments)}
     ```

4. **Verify**:
   - Run typecheck: `npx tsc --noEmit`
   - Run build: `npm run build`

---

## 3. How to Search the Codebase Efficiently

### In VS Code / Cursor / IDE (`Ctrl + Shift + F` / `Cmd + Shift + F`)

| Want to find... | What to search for | Example Search Query |
| :--- | :--- | :--- |
| Page UI Component | URL path | `/outsourcing` or `Header title="Job Cards"` |
| Backend Endpoint | API URL route | `r'jobs'` or `'outsource-vendors'` |
| API Service Function | Function call name | `jobsApi.list` or `outsourceVendorsApi` |
| Backend ViewSet | Endpoint name | `class JobCardViewSet` |
| Database Model | Table / Model name | `class OutsourcedRepair` |
| Filter Logic | FilterSet class | `class JobCardFilter` |

### Using Terminal Command Line (Grep)

```bash
# Search for frontend API calls
grep -rn "jobsApi.list" frontend/src/

# Search for backend model definitions
grep -rn "class JobCard" Backend/jobs/

# Search for permission keys
grep -rn "canViewJobCards" frontend/src/
```

---

## 4. Troubleshooting Common Scenarios

### Scenario A: Filter Dropdown throws 400 Bad Request

- **Symptom**: Selecting a filter choice (e.g. `assigned_technician=unassigned`) returns `400 Bad Request`.
- **Cause**: DjangoFilterBackend uses default `ModelChoiceFilter` which validates choices against database primary keys (UUIDs) before `get_queryset` runs.
- **Solution**:
  1. Open `Backend/jobs/views.py`.
  2. Create a custom `FilterSet` class extending `filters.FilterSet`:
     ```python
     class JobCardFilter(filters.FilterSet):
         assigned_technician = filters.CharFilter(method='filter_assigned_technician')

         def filter_assigned_technician(self, queryset, name, value):
             if value.lower() in ['unassigned', 'null']:
                 return queryset.filter(assigned_technician__isnull=True)
             return queryset.filter(assigned_technician_id=value)
     ```
  3. Set `filterset_class = JobCardFilter` on ViewSet.

---

### Scenario B: Data changes on screen but revert after page refresh

- **Symptom**: User updates job status or assigns technician, but upon refresh it reverts.
- **Cause**: TanStack React Query optimistic cache update succeeded in local memory, but backend API request failed silently or cache was not invalidated.
- **Solution**:
  1. Check Network tab for red 400/500 API errors.
  2. Ensure mutation `onSettled` invalidates queries:
     ```typescript
     queryClient.invalidateQueries({ queryKey: ["jobs"] });
     ```

---

### Scenario C: Users cannot access a new page (blank screen or redirect)

- **Symptom**: User accesses `/outsourcing` and gets redirected to login or dashboard.
- **Cause**: ProtectedRoute wrapper specifies a permission key not assigned to the user's role.
- **Solution**:
  1. Check `ProtectedRoute` prop in `page.tsx`:
     ```tsx
     <ProtectedRoute requiredPermission="canViewJobCards">
     ```
  2. Verify role permissions in `frontend/src/types/index.ts` (`ROLE_PERMISSIONS`).

---

## 5. Verification & Build Commands Checklist

Always run verification commands before committing code changes:

```bash
# 1. Typecheck Frontend (0 errors expected)
cd frontend
npx tsc --noEmit

# 2. Test Production Build
npm run build

# 3. Run Frontend Unit Tests
npm test

# 4. Run Django Backend Tests
cd ../Backend
python manage.py test
```

---

## Summary Checklist for Team Debugging

- [ ] **Opened Network Tab (`F12` ➔ `Fetch/XHR`)**
- [ ] **Checked HTTP Status Code (`200`, `400`, `401`, `403`, `500`)**
- [ ] **Inspected `Response` tab JSON payload**
- [ ] **Mapped URL to Frontend `page.tsx` and Backend `views.py`**
- [ ] **Verified TypeScript types (`npx tsc --noEmit`)**
- [ ] **Verified Production Build (`npm run build`)**
