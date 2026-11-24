/**
 * Dirty Dozen Security Rules Verification Specification
 * Covers adversarial payload assertions against firestore.rules.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  actor: string;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED' | 'ALLOW';
}

export const DIRTY_DOZEN_TEST_CASES: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Self-Role Escalation on User Profile Create',
    collectionPath: 'users/op_123',
    operation: 'create',
    actor: 'unprivileged@example.com (email_verified: true)',
    payload: {
      uid: 'op_123',
      stationId: 'STN-HWY-04',
      displayName: 'Mallory',
      employeeCode: 'EMP-999',
      role: 'OWNER',
      status: 'ACTIVE',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Shadow Ghost Field Injection on Role Request',
    collectionPath: 'roleRequests/op_123',
    operation: 'create',
    actor: 'op_123',
    payload: {
      uid: 'op_123',
      email: 'op@example.com',
      displayName: 'Operator',
      stationId: 'STN-HWY-04',
      requestedRole: 'OPERATOR',
      status: 'PENDING',
      isAdmin: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Unverified Email Spoofing Attack',
    collectionPath: 'stations/STN-HWY-04',
    operation: 'create',
    actor: 'k.m.d.unreal@gmail.com (email_verified: false)',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Cross-User PII Blanket Read',
    collectionPath: 'users/other_uid/private/pii',
    operation: 'get',
    actor: 'MANAGER (uid: mgr_01)',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Cross-Station Shift Mutation',
    collectionPath: 'stations/STN-OTHER/shifts/shf_01',
    operation: 'update',
    actor: 'MANAGER (stationId: STN-HWY-04)',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Terminal State Shift Tampering (APPROVED)',
    collectionPath: 'stations/STN-HWY-04/shifts/shf_locked',
    operation: 'update',
    actor: 'MANAGER (stationId: STN-HWY-04)',
    payload: { actualCashCollected: 100 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Path Variable ID Poisoning',
    collectionPath: 'stations/STN$BAD$ID',
    operation: 'create',
    actor: 'OWNER',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Client-Forged Timestamp Injection',
    collectionPath: 'stations/STN-HWY-04/shifts/shf_02',
    operation: 'create',
    actor: 'MANAGER',
    payload: { createdAt: '2020-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Immutable Audit Log Deletion',
    collectionPath: 'stations/STN-HWY-04/auditLogs/aud_01',
    operation: 'delete',
    actor: 'OWNER',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Unbalanced Double-Entry Journal Creation',
    collectionPath: 'stations/STN-HWY-04/journals/jv_01',
    operation: 'create',
    actor: 'OWNER',
    payload: { totalDebit: 5000, totalCredit: 4500 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Unscoped Role Request Collection Scraping',
    collectionPath: 'roleRequests',
    operation: 'list',
    actor: 'OPERATOR (without uid filter)',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Self-Approval of Role Access Request',
    collectionPath: 'roleRequests/op_123',
    operation: 'update',
    actor: 'op_123',
    payload: { status: 'APPROVED' },
    expectedResult: 'PERMISSION_DENIED',
  },
];
