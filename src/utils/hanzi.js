// import HanziWriter from "hanzi-writer";
// import { CWIDTH, CHEIGHT } from "../pages/Play";
// let cachedWriter = null;
// let cachedDiv = null;
// export function testtHanziWriter(div, char) {
//   if (!cachedWriter || cachedDiv !== div) {
//     cachedDiv = div;
//     cachedWriter = HanziWriter.create(div, char, {
//       width: CWIDTH,
//       height: CHEIGHT,
//       padding: 20,
//       showOutline: true,
//       showCharacter: false,
//       strokeAnimationSpeed: 2,
//       delayBetweenStrokes: 300,
//     });
//   } else {
//     cachedWriter.setCharacter(char); // <── cheap, no DOM rebuild
//   }
//   return cachedWriter;
// }

// utils/hanzi.js
import HanziWriter from "hanzi-writer";

let cachedWriter = null;
let cachedDiv = null;

export function testtHanziWriter(div, char, width, height) {
  if (!cachedWriter || cachedDiv !== div) {
    cachedDiv = div;
    cachedWriter = HanziWriter.create(div, char, {
      width,
      height,
      padding: 20,
      showOutline: true,
      showCharacter: false,
      strokeAnimationSpeed: 2,
      delayBetweenStrokes: 300,
    });
  } else {
    cachedWriter.setCharacter(char);
  }
  return cachedWriter;
}

