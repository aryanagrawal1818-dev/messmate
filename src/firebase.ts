import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const BOOTSTRAPPED_ADMIN_EMAIL = 'aryanagrawal1818@gmail.com';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface SanitizedFirestoreError {
  error: string;
  operationType: OperationType;
  path: string | null;
}

/**
 * Redacts JWTs, bearer tokens, and email addresses so personal auth data
 * or tokens are never printed to console logs.
 */
export function sanitizeErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? 'Unknown error');
  return raw
    .replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[REDACTED_TOKEN]')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');
}

/**
 * Converts a raw Firebase Auth / Firestore error into a clear, actionable message
 * for the UI without throwing or logging personal auth data.
 */
export function formatUserFacingFirebaseError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): string {
  const sanitized = sanitizeErrorMessage(error);
  const lower = sanitized.toLowerCase();

  if (
    lower.includes('token-service-api-has-not-been-used') ||
    lower.includes('securetoken.googleapis.com')
  ) {
    return 'Firebase Token Service API (securetoken.googleapis.com) is not enabled or has not finished propagating in Google Cloud project 295506565539. Enable Token Service API in Google Cloud Console, wait a few minutes, and click Retry.';
  }

  if (lower.includes('identitytoolkit.googleapis.com')) {
    return 'Identity Toolkit API (identitytoolkit.googleapis.com) is disabled in the Google Cloud project. Enable it in Google Cloud Console and click Retry.';
  }

  if (lower.includes('the client is offline') || lower.includes('unavailable')) {
    return `Firestore database connection is currently unavailable (${operationType} on ${path || 'database'}). Check your network or Firebase configuration and click Retry.`;
  }

  if (lower.includes('missing or insufficient permissions') || lower.includes('permission-denied')) {
    return `Database permission denied during ${operationType} on "${path || 'resource'}". Verify your account role or click Retry.`;
  }

  return `Database operation (${operationType}${path ? ` on ${path}` : ''}) failed: ${sanitized}`;
}

/**
 * Non-throwing error reporter. Logs only sanitized operation metadata
 * (never user tokens, UIDs, or email addresses) and returns a readable message.
 */
export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): string {
  const sanitizedError = sanitizeErrorMessage(error);
  const logPayload: SanitizedFirestoreError = {
    error: sanitizedError,
    operationType,
    path,
  };
  console.warn('Firestore operation issue:', JSON.stringify(logPayload));
  return formatUserFacingFirebaseError(error, operationType, path);
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    const msg = sanitizeErrorMessage(error);
    if (msg.includes('the client is offline')) {
      console.warn('Please check your Firebase configuration.');
    }
  }
}
testConnection();
