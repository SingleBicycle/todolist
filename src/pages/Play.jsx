import { useEffect, useRef, useState } from "react";
import { getCharacterById, getRandomCharacter } from "../firebase/database";
import { testtHanziWriter } from "../utils/hanzi";



const PlayPage = () => {
  const containerRef = useRef(null);
  const [character, setCharacter] = useState(null);
  // const [strokes, setStrokes] = useState([]);

  useEffect(() => {
   async function loadChar() {
      try {
        const data = await getRandomCharacter();
        setCharacter(data.content);
      } catch (err) {
        console.error("Error fetching character:", err);
      }
    }
    loadChar();
  }, []);

  useEffect(() => {
    if (character && containerRef.current) {
      const writer = testtHanziWriter(containerRef.current, character);

      writer.animateCharacter();
      writer.loopCharacterAnimation();
    }
  }, [character]);
  
  return (
    <div>
      <h1>Example Character</h1>
      <div ref={containerRef}></div>
    </div>
  );
};

export default PlayPage;
