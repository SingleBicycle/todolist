import { useEffect, useRef, useState } from "react";
import { 
    getAllCharacters, 
    getDifficultyCharacter, 
    getCharacterById 
} from "../firebase/database";
import { getCurrentUser } from "./Login";


const DictionaryPage = () => {

    return (
        <div className="text-[var(--text)]">
            <h2 className="text-4xl font-bold text-center mt-20 mb-8">
                Dictionary
            </h2>

        </div>
    );

};

export default DictionaryPage;