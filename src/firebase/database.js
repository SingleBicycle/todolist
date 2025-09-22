import { collection, doc, addDoc, getDoc, updateDoc, deleteDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from './config'; 


export async function getCharacterById(characterid) {
  try {
    const charDoc = await getDoc(doc(db, "characters", characterid));
    if (charDoc.exists()) {
      return { id: charDoc.characterid, ...charDoc.data() };
    } else {
      return null;
    }
  } catch (error) {
    console.error("Failed to get character", error);
    throw error;
  }
}
