export function getRandomNumber(random: () => number = Math.random): number {
  return Math.floor(random() * 100) + 1;
}
