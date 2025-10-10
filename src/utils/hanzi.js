import HanziWriter from "hanzi-writer";
import { CWIDTH, CHEIGHT } from "../pages/Play";
export function testtHanziWriter(container, character) {
  if (!container) return null;
  const writer = HanziWriter.create(container, character, {
    width: CWIDTH,
    height: CHEIGHT,
    padding: 20,
    showOutline: true,
    showCharacter: false,
    strokeAnimationSpeed: 2,
    delayBetweenStrokes: 400,
  });

  return writer;
}
