import { initializeApp } from 'firebase/app';
import { 
  initializeAuth,
  browserLocalPersistence,
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  setDoc,
  query, 
  orderBy, 
  getDoc,
  getDocs,
  Timestamp,
  serverTimestamp,
  where
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Use initializeAuth with explicit browserLocalPersistence
// so auth state is stored in localStorage and survives tab switches,
// background suspension, and page refreshes.
export const auth = initializeAuth(app, {
  persistence: browserLocalPersistence
});

// ─── Types ───────────────────────────────────────────────────────────

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'student' | 'ta';
  schoolId: string;
  createdAt: any;
}

export interface School {
  id: string;        // short human-readable code like "sq-7x3k"
  name: string;      // e.g. "University of Toronto"
  createdBy: string;  // uid of TA who created it
  createdAt: any;
}

// ─── Auth Helpers ────────────────────────────────────────────────────

export const loginWithEmail = (email: string, pass: string) => signInWithEmailAndPassword(auth, email, pass);
export const registerWithEmail = (email: string, pass: string) => createUserWithEmailAndPassword(auth, email, pass);
export const logout = () => signOut(auth);

// ─── User Profile Helpers ────────────────────────────────────────────

/**
 * Create a user profile document in Firestore at users/{uid}.
 * Called immediately after Firebase Auth registration.
 */
export async function createUserProfile(
  uid: string,
  data: { email: string; displayName: string; role: 'student' | 'ta'; schoolId: string }
): Promise<UserProfile> {
  const profile: UserProfile = {
    uid,
    email: data.email,
    displayName: data.displayName,
    role: data.role,
    schoolId: data.schoolId,
    createdAt: serverTimestamp(),
  };
  await setDoc(doc(db, 'users', uid), profile);
  return profile;
}

/**
 * Fetch the user profile for a given uid.
 * Returns null if no profile doc exists (e.g. legacy users before this system).
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return { uid: snap.id, ...snap.data() } as UserProfile;
}

// ─── School Helpers ──────────────────────────────────────────────────

/**
 * Generate a short, human-friendly school ID like "sq-7x3k".
 * Uses 4 alphanumeric chars which gives ~1.6M combinations — plenty
 * for the scale this app will operate at.
 */
export function generateSchoolId(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'; // no ambiguous chars (0/o, 1/l, i)
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `sq-${code}`;
}

/**
 * Create a new school document. The doc ID is the short school code
 * so students can look it up directly by ID.
 */
export async function createSchool(
  schoolId: string,
  data: { name: string; createdBy: string }
): Promise<School> {
  const school: School = {
    id: schoolId,
    name: data.name,
    createdBy: data.createdBy,
    createdAt: serverTimestamp(),
  };
  await setDoc(doc(db, 'schools', schoolId), school);
  return school;
}

/**
 * Fetch a school by its short ID. Returns null if it doesn't exist.
 */
export async function getSchool(schoolId: string): Promise<School | null> {
  const snap = await getDoc(doc(db, 'schools', schoolId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as School;
}

// ─── Re-exports ──────────────────────────────────────────────────────

export {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  orderBy,
  getDoc,
  getDocs,
  Timestamp,
  serverTimestamp,
  where,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
};
export type { User };

// ─── Error Handling ──────────────────────────────────────────────────

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
