import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { auth } from '../../core/firebase/firebase.config';

export class AuthService {
  // Avvia l'ascolto dei cambiamenti di stato (login, logout automatici)
  static subscribeToAuthChanges(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, callback);
  }

  // Registrazione (Email/Password)
  static async signUp(email: string, password: string): Promise<User> {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  }

  // Login (Email/Password)
  static async signIn(email: string, password: string): Promise<User> {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  }

  // Logout
  static async signOut(): Promise<void> {
    await firebaseSignOut(auth);
  }
}
