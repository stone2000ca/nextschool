// Function: detectOffTopic
// Purpose: E52-B1 — Pure regex blocklist for clearly off-topic domains.
//   Returns boolean in ~1ms, no API call.
// Last Modified: 2026-03-21

const OFF_TOPIC_PATTERNS: RegExp[] = [
  // Weather
  /\b(weather|forecast|temperature|rain(ing)?|snow(ing)?|sunny|humid(ity)?)\b/i,
  // Sports — events, leagues, teams, results
  /\b(super\s?bowl|nba|nfl|nhl|mlb|fifa|premier league|world cup|champions league|playoffs|standings|touchdown|goal scored|championship game|world series|stanley cup|march madness|who won the)\b/i,
  // Sports — generic (requires sports-ish context to avoid "test scores")
  /\b(score|game|match)\b.{0,20}\b(last night|yesterday|today|final|season|team)\b/i,
  // News / politics
  /\b(breaking news|headline|politics|election|president|prime minister|congress|senate|parliament|democrat|republican|liberal party|conservative party)\b/i,
  // Recipes / cooking
  /\b(recipe|cook(ing)?|bake|ingredient|calories|meal prep|dinner idea|best restaurant|food delivery)\b/i,
  // Coding / programming (not school-related)
  /\b(write code|debug my|python script|javascript|github|stackoverflow|compile|deploy|npm install|pull request|git commit|API endpoint)\b/i,
  // Trivia / general knowledge
  /\b(capital of|trivia|riddle|tell me a joke|fun fact|who invented|what year did|how tall is|how old is|what is the population|world record|guinness)\b/i,
  // Finance / crypto (not tuition-related)
  /\b(stock market|bitcoin|crypto|forex|trading|investment portfolio|nasdaq|dow jones|ethereum|dogecoin|S&P 500)\b/i,
  // Creative writing / non-school requests
  /\b(write me a|write a)\b.{0,10}\b(poem|song|story|essay|letter|rap|haiku|limerick|speech)\b/i,
  /\b(compose|generate)\b.{0,10}\b(poem|song|story|essay|lyrics|music)\b/i,
  // Entertainment — movies, TV, music, gaming
  /\b(movie|netflix|hulu|disney\+?|tv show|watch(ing)?|binge|spoiler|box office|imdb|rotten tomatoes|who played|cast of)\b/i,
  /\b(album|playlist|spotify|concert|tour dates|lyrics to|who sang|band|rapper|singer)\b/i,
  /\b(video game|xbox|playstation|nintendo|fortnite|minecraft|gaming|twitch|steam)\b/i,
  // Personal advice / relationships (not school-related)
  /\b(relationship advice|dating|break\s?up|my (boyfriend|girlfriend|husband|wife|ex)|love life|tinder|bumble)\b/i,
  // Philosophy / abstract
  /\b(meaning of life|what is consciousness|is there a god|what happens when (we|you) die|flat earth|conspiracy|illuminati)\b/i,
  // Travel / vacation (not school visits)
  /\b(cheap flights|hotel deals|vacation|travel to|best beaches|all[\s-]inclusive|airbnb|booking\.com|where should I travel)\b/i,
  // Shopping / e-commerce
  /\b(amazon|ebay|coupon code|promo code|best deal on|where to buy|price drop|black friday|cyber monday)\b/i,
  // Medical / health advice
  /\b(symptoms of|diagnose|medication|dosage|side effects|is it cancer|home remedy|cure for|treat(ment)? for)\b/i,
  // Explicit homework / non-school-search tasks
  /\b(solve this equation|help me with my homework|translate .{3,} to|what does .{3,} mean in (french|spanish|german|chinese|japanese))\b/i,
  // Celebrity / pop culture
  /\b(celebrity|kardashian|taylor swift|drake|beyonce|elon musk|net worth|how much does .{3,} make|who is dating)\b/i,
];

// School-context whitelist — if the message also contains school-related terms,
// it's likely on-topic even if it matches an off-topic pattern.
const SCHOOL_CONTEXT_RE = /\b(school|tuition|curriculum|admission|enrol|campus|montessori|waldorf|IB|AP|grade\s+\d|kindergarten|boarding|private school|public school|charter|catholic school|french immersion)\b/i;

export function detectOffTopic(message: string): boolean {
  // If the message contains school-related context, it's likely on-topic
  if (SCHOOL_CONTEXT_RE.test(message)) {
    return false;
  }
  return OFF_TOPIC_PATTERNS.some(re => re.test(message));
}
