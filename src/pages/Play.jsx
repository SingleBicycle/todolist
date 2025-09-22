import { useEffect, useRef, useState } from "react";
import { getCharacterById } from "../firebase/database";
import { testtHanziWriter } from "../firebase/hanzi";

const PlayPage = () => {
  const containerRef = useRef(null);
  const [character, setCharacter] = useState(null);

  useEffect(() => {
   async function loadChar() {
      try {
        const data = await getCharacterById("07dA4jyJ3RbeiCeNDXxp");
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
  );};

export default PlayPage;
