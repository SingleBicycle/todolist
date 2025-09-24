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

export async function getAllCharacters() {
  try {
    const snapshot = await getDocs(collection(db, "characters"));
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching characters:", error);
    throw error;
  }
}


export async function getRandomCharacter() {
  const all = await getAllCharacters();
  if (all.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * all.length);
  return all[randomIndex];
}


export async function getDifficultyCharacter(level) {
  const diff = await getAllCharacters();
  return diff.filter((char) => char.difficulty === level);

}