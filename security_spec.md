# PetrolOps Firestore Security Specification & TDD Spec

## 1. Core Data Invariants
1. **No Self-Assigned Privilege**: Only the bootstrapped Owner (`k.m.d.unreal@gmail.com` with `email_verified == true`) or an active `OWNER` document holder may assign `OWNER` or `MANAGER` roles in `/users/{userId}`. An active `MANAGER` may only provision `OPERATOR` accounts inside their own `stationId`.
2. **PII Isolation (Split Collection)**: Contact PII (`email`, `phone`, `emergencyContact`) is stored exclusively in `/users/{userId}/private/pii`, readable and writable only by the owning UID or an `OWNER`.
3. **Master Gate Station Scoping**: All station subcollections (`/shifts`, `/tanks`, `/products`, `/sales`, `/creditCustomers`, `/journals`, `/notifications`, `/auditLogs`) require parent `/stations/{stationId}` existence via `exists()` and station membership verification via `get(/databases/$(database)/documents/users/$(request.auth.uid))`.
4. **Immutable Audit & Posted Financial Records**: `/stations/{stationId}/auditLogs/{auditId}` and `/stations/{stationId}/creditCustomers/{customerId}/ledger/{creditTxId}` are append-only (`update: false, delete: false`).
5. **Terminal Shift Locking**: Once a Shift reaches `status == 'APPROVED'`, Operators and Managers cannot alter meter readings, cash totals, or status; only an `OWNER` may perform an audited override.
6. **Temporal & Schema Integrity**: Every create validates `createdAt == request.time`, every update validates `updatedAt == request.time` with `affectedKeys().hasOnly(...)`, and every string enforces explicit `.size()` bounds.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Self-Role Escalation**: Non-owner user attempts `setDoc(/users/{uid}, { role: 'OWNER', ... })` -> `PERMISSION_DENIED`.
2. **Shadow Field Injection**: Authenticated user appends `isSuperAdmin: true` to `/roleRequests/{uid}` -> `PERMISSION_DENIED` (`hasOnly` check).
3. **Unverified Email Spoofing**: Token with `email: 'k.m.d.unreal@gmail.com'` and `email_verified: false` attempts write -> `PERMISSION_DENIED`.
4. **PII Blanket Read**: Manager attempts `getDoc(/users/{otherUid}/private/pii)` -> `PERMISSION_DENIED`.
5. **Cross-Station Shift Tampering**: Manager of `STN-01` attempts `updateDoc(/stations/STN-02/shifts/s1, ...)` -> `PERMISSION_DENIED`.
6. **Locked Shift Mutation**: Operator or Manager attempts to alter `actualCashCollected` on an `APPROVED` shift -> `PERMISSION_DENIED`.
7. **ID Poisoning**: Client writes `/stations/invalid$$id_over_128_chars...` -> `PERMISSION_DENIED` (`isValidId`).
8. **Client-Forged Timestamp**: Client sends `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time` -> `PERMISSION_DENIED`.
9. **Audit Log Deletion**: Manager attempts `deleteDoc(/stations/STN-01/auditLogs/log1)` -> `PERMISSION_DENIED`.
10. **Unbalanced Journal Entry**: Client writes `/stations/STN-01/journals/j1` where `totalDebit != totalCredit` -> `PERMISSION_DENIED`.
11. **Unscoped List Scraping**: Unbound `getDocs(collection(db, 'roleRequests'))` by an Operator without `where('uid', '==', auth.uid)` -> `PERMISSION_DENIED`.
12. **Role Request Status Tampering**: Operator updates their own `/roleRequests/{uid}` from `PENDING` to `APPROVED` -> `PERMISSION_DENIED`.
