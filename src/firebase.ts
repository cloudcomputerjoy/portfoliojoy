import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore, getFirestore, doc, getDocFromServer } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Use initializeFirestore to set both settings and databaseId correctly
const settings = {
  experimentalForceLongPolling: true,
  // Increase connection timeout if possible via other settings or just keep it simple
};

const databaseId = (firebaseConfig as any).firestoreDatabaseId || "(default)";
console.log(`Initializing Firestore with Database ID: ${databaseId}`);

export const db = initializeFirestore(app, settings, databaseId);

async function testConnection() {
  try {
    // Attempt a more specific check
    const snap = await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connected successfully. Data exists:", snap.exists());
  } catch (error) {
    if (error instanceof Error) {
      console.error("Firestore connectivity check failed:", error.message);
      if (error.message.includes('the client is offline') || error.message.includes('unavailable') || error.message.includes('permission')) {
         console.warn(`Firestore unreachable for ${databaseId}. This might be an environment issue, incorrect Database ID, or permission denied.`);
         console.log("Config used:", JSON.stringify({ projectId: firebaseConfig.projectId, databaseId }));
      }
    }
  }
}
testConnection();
