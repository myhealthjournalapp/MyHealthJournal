// ===== FIREBASE HELPERS =====
// This file contains all Firebase-related functions

// Register a new user
async function createFirebaseUser(email, password, userData) {
  try {
    const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
    const firebaseUser = userCredential.user;
    
    // Save user profile to Firestore
    await db.collection('users').doc(firebaseUser.uid).set({
      ...userData,
      uid: firebaseUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    return firebaseUser;
  } catch (error) {
    console.error('Firebase registration error:', error);
    throw error;
  }
}

// Login user
async function loginWithFirebase(email, password) {
  try {
    const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
    return userCredential.user;
  } catch (error) {
    console.error('Firebase login error:', error);
    throw error;
  }
}

// Get user data from Firestore
async function getUserDataFromFirestore(uid) {
  try {
    const doc = await db.collection('users').doc(uid).get();
    return doc.exists ? doc.data() : null;
  } catch (error) {
    console.error('Firestore get error:', error);
    return null;
  }
}

// Sync readings to Firestore
async function syncReadingsToFirestore(uid, readings) {
  try {
    const readingsRef = db.collection('users').doc(uid).collection('readings');
    
    // Clear existing readings
    const existing = await readingsRef.get();
    const batch = db.batch();
    existing.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    
    // Upload new readings
    for (const reading of readings) {
      await readingsRef.add({
        ...reading,
        syncedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    console.log('Readings synced to Firestore');
    return true;
  } catch (error) {
    console.error('Sync error:', error);
    return false;
  }
}

// Load readings from Firestore
async function loadReadingsFromFirestore(uid) {
  try {
    const readingsRef = db.collection('users').doc(uid).collection('readings').orderBy('timestamp', 'desc');
    const snapshot = await readingsRef.get();
    
    if (snapshot.empty) return [];
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Load readings error:', error);
    return [];
  }
}