import HanziWriter from "hanzi-writer";

export function testtHanziWriter(container, character) {
  if (!container) return null;

  // Clear previous content
  container.innerHTML = "";

  const writer = HanziWriter.create(container, character, {
    width: 250,
    height: 250,
    padding: 20,
    showOutline: true,
    showCharacter: false,
    strokeAnimationSpeed: 1.2,
    delayBetweenStrokes: 400,
    
  });

  return writer;
}