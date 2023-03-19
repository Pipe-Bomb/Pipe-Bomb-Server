export function shuffle(array) {
    const dupe = Array.from(array);
    let currentIndex = dupe.length, randomIndex;
    while (currentIndex != 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [dupe[currentIndex], dupe[randomIndex]] = [dupe[randomIndex], dupe[currentIndex]];
    }
    return dupe;
}
//# sourceMappingURL=Utils.js.map