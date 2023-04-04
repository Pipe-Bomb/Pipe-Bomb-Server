import { dirname } from "path";
import { fileURLToPath } from "url";

export function shuffle<Type>(array: Type[]) {
    const dupe = Array.from(array);
    let currentIndex = dupe.length,  randomIndex;
  
    while (currentIndex != 0) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      [dupe[currentIndex], dupe[randomIndex]] = [dupe[randomIndex], dupe[currentIndex]];
    }
  
    return dupe;
}

export function convertArrayToString(items: string[]) {
  let out = "";
  for (let i = 0; i < items.length; i++) {
      if (i > 0) {
          if (i == items.length - 2) {
              out += " & ";
          } else {
              out += ", ";
          }
      }
      out += items[i];
  }
  return out;
}

export function wait(milliseconds: number) {
    return new Promise(resolve => {
        setTimeout(resolve, milliseconds);
    });
}

export function concatArrayBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
    // Calculate the total length of all buffers
    let totalLength = 0;
    for (const buffer of buffers) {
        totalLength += buffer.byteLength;
    }
  
    // Create a new buffer with the total length
    const resultBuffer = new ArrayBuffer(totalLength);
  
    // Create a Uint8Array to manipulate the buffer as bytes
    const resultArray = new Uint8Array(resultBuffer);
  
    // Use a DataView to copy the contents of each input buffer into the result buffer
    let offset = 0;
    for (const buffer of buffers) {
        const bufferArray = new Uint8Array(buffer);
        for (let i = 0; i < buffer.byteLength; i++) {
            resultArray[offset + i] = bufferArray[i];
        }
        offset += buffer.byteLength;
    }
  
    return resultBuffer;
}

export const DIRNAME = dirname(fileURLToPath(import.meta.url));