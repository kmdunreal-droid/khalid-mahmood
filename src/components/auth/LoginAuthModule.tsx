import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  KeyRound,
  Lock,
  LogIn,
  LogOut,
  ShieldAlert,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, DEFAULT_STATION_ID } from '../../firebase';
import { RoleId } from '../../data/types';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrors';
import {
  FirestoreRoleRequest,
  FirestoreUserProfile,
  useFirebaseAuth,
} from './FirebaseProvider';

const ROLE_SUMMARY: { role: string; desc: string }[] = [
  { role: 'Owner', desc: 'Full station access, P&L statements, staff approvals, and rate controls.' },
  { role: 'Manager', desc: 'Shift verification, tanker deliveries, stock dips, and daily expenses.' },
  { role: 'Operator', desc: 'Nozzle sales entry, meter readings, and shift cash handover.' },
];

export const LoginAuthModule: React.FC = () => {
  const {
    authReady,
    connectionOk,
    connectionError,
    firebaseUser,
    userProfile,
    userPii,
    roleRequest,
    station,
    isBootstrappedOwner,
    authError,
    authBusy,
    signInWithGoogle,
    signOut,
  } = useFirebaseAuth();

  const [phoneInput, setPhoneInput] = useState<string>('');
  const [emergencyInput, setEmergencyInput] = useState<string>('');
  const [piiSavedMessage, setPiiSavedMessage] = useState<string | null>(null);

  const [reqRole, setReqRole] = useState<'OPERATOR' | 'MANAGER'>('OPERATOR');
  const [reqStationId, setReqStationId] = useState<string>(DEFAULT_STATION_ID);
  const [reqDisplayName, setReqDisplayName] = useState<string>('');
  const [reqBusy, setReqBusy] = useState<boolean>(false);

  const [stationUsers, setStationUsers] = useState<FirestoreUserProfile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FirestoreRoleRequest[]>([]);

  const [provisionUid, setProvisionUid] = useState<string>('');
  const [provisionName, setProvisionName] = useState<string>('');
  const [provisionCode, setProvisionCode] = useState<string>('');
  const [provisionRole, setProvisionRole] = useState<RoleId>('OPERATOR');
  const [provisionBusy, setProvisionBusy] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  useEffect(() => {
    setPhoneInput(userPii?.phone ?? '');
    setEmergencyInput(userPii?.emergencyContact ?? '');
  }, [userPii?.phone, userPii?.emergencyContact]);

  useEffect(() => {
    if (firebaseUser?.displayName) {
      setReqDisplayName(firebaseUser.displayName.slice(0, 120));
    }
  }, [firebaseUser?.displayName]);

  const effectiveRole: RoleId | null = userProfile?.role ?? (isBootstrappedOwner ? 'OWNER' : null);
  const activeStationId = userProfile?.stationId ?? DEFAULT_STATION_ID;

  useEffect(() => {
    if (!authReady || !firebaseUser || !effectiveRole || effectiveRole === 'OPERATOR') {
      setStationUsers([]);
      setPendingRequests([]);
      return;
    }

    const usersPath = 'users';
    const usersQuery =
      effectiveRole === 'OWNER'
        ? query(collection(db, 'users'))
        : query(collection(db, 'users'), where('stationId', '==', activeStationId));

    const unsubUsers = onSnapshot(
      usersQuery,
      (snap) => {
        const list: FirestoreUserProfile[] = [];
        snap.forEach((d) => list.push(d.data() as FirestoreUserProfile));
        setStationUsers(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, usersPath)
    );

    if (effectiveRole === 'OWNER') {
      const reqPath = 'roleRequests';
      const reqQuery = query(
        collection(db, 'roleRequests'),
        where('status', '==', 'PENDING'),
        orderBy('createdAt', 'desc')
      );
      const unsubReqs = onSnapshot(
        reqQuery,
        (snap) => {
          const list: FirestoreRoleRequest[] = [];
          snap.forEach((d) => list.push(d.data() as FirestoreRoleRequest));
          setPendingRequests(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, reqPath)
      );

      return () => {
        unsubUsers();
        unsubReqs();
      };
    }

    return () => unsubUsers();
  }, [authReady, firebaseUser, effectiveRole, activeStationId]);

  const writeAuditLog = async (action: string, entityType: string, entityId: string, summary: string) => {
    if (!firebaseUser) return;
    const auditId = `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const path = `stations/${activeStationId}/auditLogs/${auditId}`;
    try {
      await setDoc(doc(db, 'stations', activeStationId, 'auditLogs', auditId), {
        stationId: activeStationId,
        actorUid: firebaseUser.uid,
        module: 'authentication',
        action: action.slice(0, 64),
        entityType: entityType.slice(0, 48),
        entityId: entityId.slice(0, 128),
        summary: summary.slice(0, 500),
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const handleSavePii = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    setPiiSavedMessage(null);
    const piiPath = `users/${firebaseUser.uid}/private/pii`;
    try {
      await setDoc(doc(db, 'users', firebaseUser.uid, 'private', 'pii'), {
        uid: firebaseUser.uid,
        email: (firebaseUser.email || '').slice(0, 160),
        phone: phoneInput.trim().slice(0, 24),
        emergencyContact: emergencyInput.trim().slice(0, 120),
        updatedAt: serverTimestamp(),
      });
      setPiiSavedMessage('Contact details saved.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, piiPath);
    }
  };

  const handleSubmitRoleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !firebaseUser.email) return;
    setReqBusy(true);
    const reqPath = `roleRequests/${firebaseUser.uid}`;
    try {
      await setDoc(doc(db, 'roleRequests', firebaseUser.uid), {
        uid: firebaseUser.uid,
        email: firebaseUser.email.slice(0, 160),
        displayName: (reqDisplayName.trim() || 'Station Staff').slice(0, 120),
        stationId: reqStationId.trim().slice(0, 128),
        requestedRole: reqRole,
        status: 'PENDING',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, reqPath);
    } finally {
      setReqBusy(false);
    }
  };

  const handleProvisionUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !effectiveRole) return;
    const cleanUid = provisionUid.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
    if (!cleanUid || !provisionName.trim()) return;

    const assignedRole: RoleId = effectiveRole === 'MANAGER' ? 'OPERATOR' : provisionRole;
    setProvisionBusy(true);
    setActionFeedback(null);
    const userPath = `users/${cleanUid}`;
    try {
      await setDoc(doc(db, 'users', cleanUid), {
        uid: cleanUid,
        stationId: activeStationId,
        displayName: provisionName.trim().slice(0, 120),
        employeeCode: (provisionCode.trim() || `EMP-${cleanUid.slice(0, 4).toUpperCase()}`).slice(0, 24),
        role: assignedRole,
        status: 'ACTIVE',
        assignedBy: firebaseUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog(
        'USER_ROLE_PROVISIONED',
        'users',
        cleanUid,
        `Assigned ${assignedRole} role on ${activeStationId} to ${provisionName.trim()}`
      );
      setProvisionUid('');
      setProvisionName('');
      setProvisionCode('');
      setActionFeedback(`Added ${provisionName.trim()} as ${assignedRole}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, userPath);
    } finally {
      setProvisionBusy(false);
    }
  };

  const handleApproveRequest = async (req: FirestoreRoleRequest, decision: 'APPROVED' | 'DECLINED') => {
    if (!firebaseUser || effectiveRole !== 'OWNER') return;
    setActionFeedback(null);
    const reqPath = `roleRequests/${req.uid}`;
    try {
      await updateDoc(doc(db, 'roleRequests', req.uid), {
        status: decision,
        updatedAt: serverTimestamp(),
      });
      if (decision === 'APPROVED') {
        const userPath = `users/${req.uid}`;
        try {
          await setDoc(doc(db, 'users', req.uid), {
            uid: req.uid,
            stationId: req.stationId,
            displayName: req.displayName.slice(0, 120),
            employeeCode: `${req.requestedRole.slice(0, 3)}-${req.uid.slice(0, 4).toUpperCase()}`,
            role: req.requestedRole,
            status: 'ACTIVE',
            assignedBy: firebaseUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, userPath);
        }
      }
      await writeAuditLog(
        `ROLE_REQUEST_${decision}`,
        'roleRequests',
        req.uid,
        `${decision} ${req.requestedRole} access request for ${req.email}`
      );
      setActionFeedback(`${decision === 'APPROVED' ? 'Approved' : 'Declined'} request for ${req.displayName}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, reqPath);
    }
  };

  const handleToggleUserStatus = async (target: FirestoreUserProfile) => {
    if (!firebaseUser || !effectiveRole) return;
    const nextStatus = target.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const userPath = `users/${target.uid}`;
    try {
      await updateDoc(doc(db, 'users', target.uid), {
        status: nextStatus,
        assignedBy: firebaseUser.uid,
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog(
        'USER_STATUS_CHANGED',
        'users',
        target.uid,
        `Changed ${target.displayName} (${target.role}) status to ${nextStatus}`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, userPath);
    }
  };

  const handleChangeUserRole = async (target: FirestoreUserProfile, newRole: RoleId) => {
    if (!firebaseUser || effectiveRole !== 'OWNER') return;
    const userPath = `users/${target.uid}`;
    try {
      await updateDoc(doc(db, 'users', target.uid), {
        role: newRole,
        assignedBy: firebaseUser.uid,
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog(
        'USER_ROLE_UPDATED',
        'users',
        target.uid,
        `Updated ${target.displayName} role from ${target.role} to ${newRole}`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, userPath);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Staff & Account
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Sign in with your station Google account and manage Owner, Manager, and Operator access.
            </p>
          </div>

          {firebaseUser ? (
            <button
              type="button"
              disabled={authBusy}
              onClick={signOut}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={authBusy || !authReady}
              onClick={signInWithGoogle}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50 transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{authBusy ? 'Signing In...' : 'Sign In with Google'}</span>
            </button>
          )}
        </div>

        {!connectionOk && connectionError && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{connectionError}</span>
          </div>
        )}

        {authError && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{authError}</span>
          </div>
        )}
      </div>

      {/* Signed-Out Sign-In Card */}
      {!firebaseUser && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white">
              <KeyRound className="w-4 h-4 text-blue-600 dark:text-emerald-400" />
              <h2 className="text-base font-semibold">Station Sign-In</h2>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Sign in to sync shifts, sales, tank dips, and accounts directly to your station cloud.
            </p>
            <button
              type="button"
              disabled={authBusy || !authReady}
              onClick={signInWithGoogle}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl disabled:opacity-50 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              <span>{authBusy ? 'Signing In...' : 'Continue with Google'}</span>
            </button>
          </div>

          <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Station Access Roles
            </h2>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {ROLE_SUMMARY.map((item) => (
                <div key={item.role} className="py-3 first:pt-0 last:pb-0">
                  <div className="text-xs font-semibold text-blue-600 dark:text-emerald-400">
                    {item.role}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Signed-In Workspace */}
      {firebaseUser && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                    Your Account
                  </h2>
                </div>
                <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  {effectiveRole ?? 'PENDING APPROVAL'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-3 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <div className="text-slate-500 dark:text-slate-400">Name & Email</div>
                  <div className="font-semibold text-slate-900 dark:text-white mt-0.5">
                    {userProfile?.displayName || firebaseUser.displayName || 'Station Staff'}
                  </div>
                  <div className="font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                    {firebaseUser.email}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 dark:text-slate-400">Assigned Station</div>
                  <div className="font-semibold text-slate-900 dark:text-white mt-0.5">
                    {station ? `${station.name} (${station.stationCode})` : activeStationId}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 dark:text-slate-400">Staff ID</div>
                  <div className="font-mono text-slate-900 dark:text-white mt-0.5">
                    {userProfile ? `${userProfile.status} · ${userProfile.employeeCode}` : 'Awaiting Assignment'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 dark:text-slate-400">Account UID</div>
                  <div className="font-mono text-slate-600 dark:text-slate-300 mt-0.5 truncate">
                    {firebaseUser.uid}
                  </div>
                </div>
              </div>
            </div>

            <form
              onSubmit={handleSavePii}
              className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
            >
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Emergency Contact
                </h2>
              </div>

              <div className="space-y-3 text-xs">
                <label className="block space-y-1">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Mobile Number</span>
                  <input
                    type="text"
                    maxLength={24}
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="+92-300-1234567"
                    className="w-full min-h-[40px] px-3 py-2 font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Emergency Contact</span>
                  <input
                    type="text"
                    maxLength={120}
                    value={emergencyInput}
                    onChange={(e) => setEmergencyInput(e.target.value)}
                    placeholder="Name & phone number"
                    className="w-full min-h-[40px] px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  {piiSavedMessage ?? ''}
                </span>
                <button
                  type="submit"
                  className="min-h-[40px] px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>

          {/* Access Request (Unprovisioned User) */}
          {!effectiveRole && (
            <div className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 p-6 space-y-4">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <h2 className="text-base font-semibold">Request Station Access</h2>
              </div>

              {roleRequest ? (
                <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs space-y-1">
                  <div className="font-semibold text-slate-900 dark:text-white">
                    Status: <span className="font-mono text-blue-600 dark:text-blue-400">{roleRequest.status}</span>
                  </div>
                  <div className="text-slate-600 dark:text-slate-300">
                    Requested {roleRequest.requestedRole} for station {roleRequest.stationId}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmitRoleRequest} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs items-end">
                  <label className="block space-y-1">
                    <span className="font-medium text-slate-700 dark:text-slate-300">Full Name</span>
                    <input
                      type="text"
                      required
                      maxLength={120}
                      value={reqDisplayName}
                      onChange={(e) => setReqDisplayName(e.target.value)}
                      className="w-full min-h-[40px] px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="font-medium text-slate-700 dark:text-slate-300">Station Code</span>
                    <input
                      type="text"
                      required
                      maxLength={128}
                      value={reqStationId}
                      onChange={(e) => setReqStationId(e.target.value)}
                      className="w-full min-h-[40px] px-3 py-2 font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="font-medium text-slate-700 dark:text-slate-300">Role</span>
                    <select
                      value={reqRole}
                      onChange={(e) => setReqRole(e.target.value as 'OPERATOR' | 'MANAGER')}
                      className="w-full min-h-[40px] px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    >
                      <option value="OPERATOR">Operator</option>
                      <option value="MANAGER">Manager</option>
                    </select>
                  </label>
                  <button
                    type="submit"
                    disabled={reqBusy}
                    className="min-h-[40px] px-4 py-2 font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50"
                  >
                    {reqBusy ? 'Sending...' : 'Send Request'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Owner / Manager Staff Directory */}
          {(effectiveRole === 'OWNER' || effectiveRole === 'MANAGER') && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <form
                onSubmit={handleProvisionUser}
                className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
              >
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-blue-600 dark:text-emerald-400" />
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                    Add Staff Member
                  </h2>
                </div>

                <div className="space-y-3 text-xs">
                  <label className="block space-y-1">
                    <span className="font-medium text-slate-700 dark:text-slate-300">Staff Account UID</span>
                    <input
                      type="text"
                      required
                      maxLength={128}
                      value={provisionUid}
                      onChange={(e) => setProvisionUid(e.target.value)}
                      placeholder="Paste Firebase UID"
                      className="w-full min-h-[40px] px-3 py-2 font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block space-y-1">
                      <span className="font-medium text-slate-700 dark:text-slate-300">Full Name</span>
                      <input
                        type="text"
                        required
                        maxLength={120}
                        value={provisionName}
                        onChange={(e) => setProvisionName(e.target.value)}
                        placeholder="Bilal Ahmed"
                        className="w-full min-h-[40px] px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="font-medium text-slate-700 dark:text-slate-300">Staff Code</span>
                      <input
                        type="text"
                        maxLength={24}
                        value={provisionCode}
                        onChange={(e) => setProvisionCode(e.target.value)}
                        placeholder="EMP-019"
                        className="w-full min-h-[40px] px-3 py-2 font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                      />
                    </label>
                  </div>

                  <label className="block space-y-1">
                    <span className="font-medium text-slate-700 dark:text-slate-300">Role</span>
                    <select
                      value={effectiveRole === 'MANAGER' ? 'OPERATOR' : provisionRole}
                      disabled={effectiveRole === 'MANAGER'}
                      onChange={(e) => setProvisionRole(e.target.value as RoleId)}
                      className="w-full min-h-[40px] px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white disabled:opacity-60"
                    >
                      <option value="OPERATOR">Operator</option>
                      {effectiveRole === 'OWNER' && <option value="MANAGER">Manager</option>}
                      {effectiveRole === 'OWNER' && <option value="OWNER">Owner</option>}
                    </select>
                  </label>
                </div>

                {actionFeedback && (
                  <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    {actionFeedback}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={provisionBusy}
                  className="w-full min-h-[42px] px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg disabled:opacity-50 transition-colors"
                >
                  {provisionBusy ? 'Saving...' : 'Assign Role'}
                </button>
              </form>

              <div className="lg:col-span-7 space-y-4">
                {effectiveRole === 'OWNER' && pendingRequests.length > 0 && (
                  <div className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 overflow-hidden">
                    <div className="px-5 py-3 border-b border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-xs font-semibold text-amber-900 dark:text-amber-300">
                      Pending Access Requests ({pendingRequests.length})
                    </div>
                    <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                      {pendingRequests.map((req) => (
                        <div key={req.uid} className="px-5 py-3 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {req.displayName} · <span className="font-mono text-blue-600 dark:text-blue-400">{req.requestedRole}</span>
                            </div>
                            <div className="font-mono text-slate-500 dark:text-slate-400">
                              {req.email}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleApproveRequest(req, 'APPROVED')}
                              className="min-h-[36px] px-3 py-1.5 font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApproveRequest(req, 'DECLINED')}
                              className="min-h-[36px] px-3 py-1.5 font-medium border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Station Staff ({stationUsers.length})
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                          <th className="py-2.5 px-5">Staff</th>
                          <th className="py-2.5 px-4">Role</th>
                          <th className="py-2.5 px-4">Status</th>
                          <th className="py-2.5 px-5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                        {stationUsers.map((u) => (
                          <tr key={u.uid} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-2.5 px-5">
                              <div className="font-medium text-slate-900 dark:text-white">{u.displayName}</div>
                              <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                {u.employeeCode}
                              </div>
                            </td>
                            <td className="py-2.5 px-4">
                              {effectiveRole === 'OWNER' && u.uid !== firebaseUser.uid ? (
                                <select
                                  value={u.role}
                                  onChange={(e) => handleChangeUserRole(u, e.target.value as RoleId)}
                                  className="px-2 py-1 font-mono border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs"
                                >
                                  <option value="OWNER">OWNER</option>
                                  <option value="MANAGER">MANAGER</option>
                                  <option value="OPERATOR">OPERATOR</option>
                                </select>
                              ) : (
                                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                                  {u.role}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 font-mono">
                              <span
                                className={
                                  u.status === 'ACTIVE'
                                    ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                                    : 'text-red-600 dark:text-red-400 font-semibold'
                                }
                              >
                                {u.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-5 text-right">
                              {u.uid !== firebaseUser.uid &&
                                (effectiveRole === 'OWNER' || u.role === 'OPERATOR') && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleUserStatus(u)}
                                    className="px-2.5 py-1 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                                  >
                                    {u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                                  </button>
                                )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
