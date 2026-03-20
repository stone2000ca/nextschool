// Function: detectOffTopic
// Purpose: E52-B1 — Pure regex blocklist for clearly off-topic domains.
//   Returns boolean in ~1ms, no API call.
// Last Modified: 2026-03-20

const OFF_TOPIC_PATTERNS: RegExp[] = [
  // Weather
  /\b(weather|forecast|temperature|rain(ing)?|snow(ing)?|sunny|humid(ity)?)\b/i,
  // Sports
  /\b(score|game|nba|nfl|nhl|mlb|premier league|world cup|playoffs|standings|touchdown|goal scored)\b/i,
  // News / politics
  /\b(breaking news|headline|politics|election|president|prime minister|congress|senate)\b/i,
  // Recipes / cooking
  /\b(recipe|cook(ing)?|bake|ingredient|calories|meal prep|dinner idea)\b/i,
  // Coding / programming (not school-related)
  /\b(write code|debug|python|javascript|github|stackoverflow|compile|deploy|npm install)\b/i,
  // Trivia / general knowledge
  /\b(capital of|trivia|riddle|joke|fun fact|who invented|what year did)\b/i,
  // Finance / crypto (not tuition-related)
  /\b(stock market|bitcoin|crypto|forex|trading|investment portfolio|nasdaq|dow jones)\b/i,
];

export function detectOffTopic(message: string): boolean {
  return OFF_TOPIC_PATTERNS.some(re => re.test(message));
}
