import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {
  auth,
  BOOTSTRAPPED_OWNER_EMAIL,
  db,
  DEFAULT_STATION_ID,
  googleProvider,
  testConnection,
} from '../../firebase';
import { RoleId } from '../../data/types';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrors';

export interface FirestoreUserProfile {
  uid: string;
  stationId: string;
  displayName: string;
  employeeCode: string;
  role: RoleId;
  status: 'ACTIVE' | 'SUSPENDED';
  assignedBy: string;
}

export interface FirestoreUserPii {
  uid: string;
  email: string;
  phone: string;
  emergencyContact?: string;
}

export interface FirestoreRoleRequest {
  uid: string;
  email: string;
  displayName: string;
  stationId: string;
  requestedRole: 'MANAGER' | 'OPERATOR';
  status: 'PENDING' | 'APPROVED' | 'DECLINED';
}

export interface FirestoreStation {
  stationCode: string;
  name: string;
  licenseNo: string;
  taxGstNo: string;
  timezone: string;
  ownerUid: string;
  isActive: boolean;
}

interface FirebaseContextValue {
  authReady: boolean;
  connectionOk: boolean;
  connectionError: string | null;
  firebaseUser: User | null;
  userProfile: FirestoreUserProfile | null;
  userPii: FirestoreUserPii | null;
  roleRequest: FirestoreRoleRequest | null;
  station: FirestoreStation | null;
  isBootstrappedOwner: boolean;
  activeRole: RoleId;
  setActiveRole: (role: RoleId) => void;
  isRoleLocked: boolean;
  authError: string | null;
  authBusy: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export function useFirebaseAuth(): FirebaseContextValue {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebaseAuth must be used inside FirebaseProvider');
  }
  return ctx;
}

function sanitizeText(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [connectionOk, setConnectionOk] = useState<boolean>(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<FirestoreUserProfile | null>(null);
  const [userPii, setUserPii] = useState<FirestoreUserPii | null>(null);
  const [roleRequest, setRoleRequest] = useState<FirestoreRoleRequest | null>(null);
  const [station, setStation] = useState<FirestoreStation | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState<boolean>(false);
  const [previewRole, setPreviewRole] = useState<RoleId>('OWNER');

  // Startup Firestore connectivity check
  useEffect(() => {
    let mounted = true;
    testConnection().then((res) => {
      if (!mounted) return;
      setConnectionOk(res.ok);
      setConnectionError(res.error ?? null);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAuthReady(true);

      if (!user) {
        setUserProfile(null);
        setUserPii(null);
        setRoleRequest(null);
        setStation(null);
        return;
      }

      // If bootstrapped Owner signs in for the first time, ensure default station & OWNER profile exist
      const isOwnerEmail =
        user.email === BOOTSTRAPPED_OWNER_EMAIL && user.emailVerified;

      if (isOwnerEmail) {
        const stationPath = `stations/${DEFAULT_STATION_ID}`;
        try {
          const stationSnap = await getDoc(doc(db, 'stations', DEFAULT_STATION_ID));
          if (!stationSnap.exists()) {
            await setDoc(doc(db, 'stations', DEFAULT_STATION_ID), {
              stationCode: DEFAULT_STATION_ID,
              name: 'Highway Meridian Fuels',
              licenseNo: 'PESO-KA-2026-8841',
              taxGstNo: '29AABCM1234F1Z5',
              timezone: 'Asia/Kolkata',
              ownerUid: user.uid,
              isActive: true,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, stationPath);
        }

        const userPath = `users/${user.uid}`;
        try {
          const userSnap = await getDoc(doc(db, 'users', user.uid));
          if (!userSnap.exists()) {
            await setDoc(doc(db, 'users', user.uid), {
              uid: user.uid,
              stationId: DEFAULT_STATION_ID,
              displayName: sanitizeText(user.displayName || 'Station Owner', 120),
              employeeCode: 'OWN-001',
              role: 'OWNER',
              status: 'ACTIVE',
              assignedBy: user.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, userPath);
        }

        const piiPath = `users/${user.uid}/private/pii`;
        try {
          const piiSnap = await getDoc(doc(db, 'users', user.uid, 'private', 'pii'));
          if (!piiSnap.exists()) {
            await setDoc(doc(db, 'users', user.uid, 'private', 'pii'), {
              uid: user.uid,
              email: sanitizeText(user.email || '', 160),
              phone: '',
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, piiPath);
        }
      }
    });

    return () => unsub();
  }, []);

  // Firestore real-time listeners (strictly gated on authReady && firebaseUser)
  useEffect(() => {
    if (!authReady || !firebaseUser) return;

    const userPath = `users/${firebaseUser.uid}`;
    const unsubUser = onSnapshot(
      doc(db, 'users', firebaseUser.uid),
      (snap) => {
        if (snap.exists()) {
          setUserProfile(snap.data() as FirestoreUserProfile);
        } else {
          setUserProfile(null);
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, userPath)
    );

    const piiPath = `users/${firebaseUser.uid}/private/pii`;
    const unsubPii = onSnapshot(
      doc(db, 'users', firebaseUser.uid, 'private', 'pii'),
      (snap) => {
        if (snap.exists()) {
          setUserPii(snap.data() as FirestoreUserPii);
        } else {
          setUserPii(null);
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, piiPath)
    );

    const reqPath = `roleRequests/${firebaseUser.uid}`;
    const unsubReq = onSnapshot(
      doc(db, 'roleRequests', firebaseUser.uid),
      (snap) => {
        if (snap.exists()) {
          setRoleRequest(snap.data() as FirestoreRoleRequest);
        } else {
          setRoleRequest(null);
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, reqPath)
    );

    return () => {
      unsubUser();
      unsubPii();
      unsubReq();
    };
  }, [authReady, firebaseUser]);

  // Listen to assigned station once userProfile is loaded
  useEffect(() => {
    if (!authReady || !firebaseUser || !userProfile?.stationId) {
      setStation(null);
      return;
    }

    const stationPath = `stations/${userProfile.stationId}`;
    const unsubStation = onSnapshot(
      doc(db, 'stations', userProfile.stationId),
      (snap) => {
        if (snap.exists()) {
          setStation(snap.data() as FirestoreStation);
        } else {
          setStation(null);
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, stationPath)
    );

    return () => unsubStation();
  }, [authReady, firebaseUser, userProfile?.stationId]);

  const signInWithGoogle = async () => {
    setAuthError(null);
    setAuthBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google Sign-In failed.';
      setAuthError(msg);
    } finally {
      setAuthBusy(false);
    }
  };

  const signOut = async () => {
    setAuthError(null);
    setAuthBusy(true);
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-Out failed.';
      setAuthError(msg);
    } finally {
      setAuthBusy(false);
    }
  };

  const isBootstrappedOwner = Boolean(
    firebaseUser?.email === BOOTSTRAPPED_OWNER_EMAIL && firebaseUser?.emailVerified
  );

  const authenticatedRole: RoleId | null =
    userProfile?.role ?? (isBootstrappedOwner ? 'OWNER' : null);

  const isRoleLocked =
    authenticatedRole === 'MANAGER' || authenticatedRole === 'OPERATOR';

  const activeRole: RoleId =
    isRoleLocked && authenticatedRole ? authenticatedRole : previewRole;

  const setActiveRole = (nextRole: RoleId) => {
    if (isRoleLocked) return;
    setPreviewRole(nextRole);
  };

  return (
    <FirebaseContext.Provider
      value={{
        authReady,
        connectionOk,
        connectionError,
        firebaseUser,
        userProfile,
        userPii,
        roleRequest,
        station,
        isBootstrappedOwner,
        activeRole,
        setActiveRole,
        isRoleLocked,
        authError,
        authBusy,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
};
