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