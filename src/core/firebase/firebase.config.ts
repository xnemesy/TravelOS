import { initializeApp, getApp, getApps } from 'firebase/app';
import * as fbAuth from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Estratti dal GoogleService-Info.plist di Travel OS
const firebaseConfig = {
  apiKey: "AIzaSyBuCrDC-dskdKLIEZWmCgz4pkOG1a5Aa34",
  authDomain: "travel-os-28bb9.firebaseapp.com",
  projectId: "travel-os-28bb9",
  storageBucket: "travel-os-28bb9.firebasestorage.app",
  messagingSenderId: "518009465151",
  appId: "1:518009465151:ios:746d3b5df5faa0437acb8a",
};

// Inizializza l'app in modo sicuro (evita instanziazioni doppie con l'hot reload)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Inizializza l'Auth con persistenza tramite AsyncStorage per React Native in modo sicuro
let auth: any;
try {
  const getPersistence = (fbAuth as any).getReactNativePersistence;
  if (typeof getPersistence === 'function') {
    auth = fbAuth.initializeAuth(app, {
      persistence: getPersistence(AsyncStorage)
    });
  } else {
    auth = fbAuth.getAuth(app);
  }
} catch (error) {
  auth = fbAuth.getAuth(app);
}

// Inizializza i servizi
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
