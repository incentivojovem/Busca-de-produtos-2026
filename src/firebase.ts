import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  projectId: 'productsearch231',
  appId: '1:637789705900:web:b6be198df57099dceb7109',
  apiKey: 'AIzaSyB5EVqvQUqHzOZAIGTaihQ8NW56i-Xr0bA',
  authDomain: 'productsearch231.firebaseapp.com',
  storageBucket: 'productsearch231.firebasestorage.app',
  messagingSenderId: '637789705900'
};

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
