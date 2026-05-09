# RBAC & Permissions Reference

## Role Overview

| Role | Who uses it | Access scope |
|------|-------------|-------------|
| `SUPER_ADMIN` | Platform admin (Anthropic/vendor) | All organizations |
| `OWNER` | Business owner | Entire organization, all branches |
| `MANAGER` | Branch manager | Assigned branch(es) |
| `RECEPTIONIST` | Front-desk staff | Assigned branch — intake & customer ops |
| `TECHNICIAN` | Repair technician | Assigned jobs only |
| `ACCOUNTANT` | Finance staff | Billing, payments, reports only |

---

## Permission Matrix

| Permission | SUPER_ADMIN | OWNER | MANAGER | RECEPTIONIST | TECHNICIAN | ACCOUNTANT |
|-----------|:-----------:|:-----:|:-------:|:------------:|:----------:|:----------:|
| `canViewDashboard` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `canViewJobCards` | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| `canCreateJobCards` | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| `canEditJobCards` | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| `canViewInventory` | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| `canManageInventory` | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| `canViewBilling` | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ |
| `canCreateInvoices` | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ |
| `canViewReports` | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ |
| `canManageBranches` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `canManageUsers` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `canViewPickups` | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |

> **Note:** The above are the seeded defaults from migration `0005_seed_role_permissions`. Owners can modify these in the Admin panel — changes take effect after the 5-minute Redis cache TTL expires.

---

## Branch Access Rules

| Role | Which branches they can access |
|------|-------------------------------|
| `SUPER_ADMIN` | All branches across all organizations |
| `OWNER` | All branches within their organization |
| `MANAGER` | Only branches they are explicitly assigned to |
| `RECEPTIONIST` | Only branches they are explicitly assigned to |
| `TECHNICIAN` | Only branches they are explicitly assigned to |
| `ACCOUNTANT` | Only branches they are explicitly assigned to |

Users can be assigned to multiple branches by an Owner or Super Admin via `POST /api/core/users/{id}/assign_branches/`.

The current active branch is stored in `localStorage('scm_current_branch')` and sent as the `X-Branch-ID` header on every API request.

---

## DRF Permission Classes

These are the server-side enforcements. They combine into a permission chain on each view.

### `BranchScopedMixin`
Applied to almost all ViewSets. Filters the queryset to only records in branches the user can access.  
If `X-Branch-ID` header is present and the user has access to that branch, filters to that specific branch.

### `IsBranchMember`
Verifies `user.has_branch_access(branch)` for the branch in the request context.  
Returns 403 `branch_access_denied` if the user cannot access the requested branch.

### `IsOwner`
Role must be `SUPER_ADMIN` or `OWNER`.

### `IsOwnerOrManager`
Role must be `SUPER_ADMIN`, `OWNER`, or `MANAGER`.

### `IsOwnerManagerOrAccountant`
Role must be `SUPER_ADMIN`, `OWNER`, `MANAGER`, or `ACCOUNTANT`.

### `CanManageJobs`
- **GET**: requires `canViewJobCards`
- **POST**: requires `canCreateJobCards`
- **PUT/PATCH**: requires `canEditJobCards`

### `CanManageBilling`
- **GET**: requires `canViewBilling`
- **POST/PUT/PATCH**: requires `canCreateInvoices`

### `CanManageInventory`
- **GET**: requires `canViewInventory`
- **POST/PUT/PATCH/DELETE**: requires `canManageInventory`

### `CanViewReports`
Requires `canViewReports`.

### `CanManageUsers`
Requires `canManageUsers`.

### `CanAssignBranches`
Requires `canManageBranches`.

### `CanOverrideStatus`
Role must be `SUPER_ADMIN`, `OWNER`, or `MANAGER`. Used for forced status transitions on jobs.

### `IsTechnicianOrAbove`
Role must be `SUPER_ADMIN`, `OWNER`, `MANAGER`, or `TECHNICIAN`. Used for diagnosis actions and device password access.

### `CanAccessDevicePasswords`
Same as `IsTechnicianOrAbove`. All accesses are logged in `AuditPasswordAccess`.

### `CanManageCustomers`
- **GET**: all authenticated users
- **POST/PUT/PATCH**: requires role in `[OWNER, MANAGER, RECEPTIONIST]`

---

## Frontend Permission Gates

### `useAuth().hasPermission(key)`

Returns `true`/`false`. Checks against the `permissions` object in the user context (loaded from `/api/core/users/me/` on login).

```typescript
const { hasPermission } = useAuth();
if (hasPermission('canViewBilling')) {
  // Show billing section
}
```

### `useAuth().isRole(...roles)`

```typescript
const { isRole } = useAuth();
if (isRole('OWNER', 'MANAGER')) {
  // Show management controls
}
```

### `<ProtectedRoute>`

Route-level permission gate. Redirects to dashboard if access denied.

```tsx
<ProtectedRoute requiredPermission="canCreateInvoices">
  <BillingNewPage />
</ProtectedRoute>
```

### Navigation filtering

The `Sidebar` component filters navigation items at render time. Each nav item has optional `permission` and `roles` constraints. Items not matching are hidden entirely — the user does not see inaccessible menu items.

---

## How to Change Permissions

Permissions can be changed per role without a redeploy:

**Via Django Admin:**
1. Go to `/admin/core/rolepermission/`
2. Select the role row to edit
3. Toggle permission checkboxes
4. Save

**Via API (SUPER_ADMIN only):**
```
PATCH /api/core/roles/{role}/permissions/
{ "can_view_billing": true }
```

**Cache invalidation:** The `RolePermission.save()` signal automatically deletes the Redis cache key `scm:1:role_perms_{role}`. All subsequent requests see the new permissions within milliseconds. Existing API calls in-flight (< 5 minutes old) continue with the old cached permissions until expiry.

---

## Special Access Rules (not in permission matrix)

### Device password access
- Visible to: TECHNICIAN, MANAGER, OWNER, SUPER_ADMIN
- Every access is logged in `AuditPasswordAccess` with user, timestamp, reason, and IP
- Receptionist and Accountant **cannot** access device passwords

### Status override
- Any status transition (bypassing `ALLOWED_STATUS_TRANSITIONS`) requires OWNER or MANAGER
- Achieved by setting `is_override: true` in the `update_status` API call

### Invoice hard delete
- **No one can hard-delete an invoice** — GST 8-year retention policy
- Use `cancel` action instead (sets status to CANCELLED)

### Job delete
- Deleting a job with linked inventory usage or invoices returns **409 Conflict**
- Cancel the job instead

### Cross-branch data access
- Users cannot read or write records from branches they are not assigned to
- OWNER and SUPER_ADMIN are exempt and see all branches in their org/platform
