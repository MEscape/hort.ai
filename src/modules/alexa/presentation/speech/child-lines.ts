/**
 * The fixed sentences the coupled child's companion says on Alexa. Each one is also a line of the voice
 * module's reviewed `channel-lines.json` (a test keeps them equal), so it is spoken in the companion's own
 * voice; they hold no data about a child. Wording follows the web's `progression.feed.says.*`.
 * Dynamic parts (numbers outside the lists, teacher titles) are spoken in Alexa's voice instead.
 */
export const CHILD_LINES = {
  hello: 'Hallo, schön, dass du da bist!',
  learningPause: 'Jetzt ist Lernpause. Bis später!',
  snack: 'Magst du mich füttern?',
  snackHungry: 'Ich habe Hunger, magst du mich füttern?',
  snackSleepy: 'Ich bin müde, magst du mich füttern?',
  teacherTask: 'Deine Lehrerin hat dir eine Aufgabe gegeben.',
  teacherTasks: 'Deine Lehrerin hat dir Aufgaben gegeben.',
  whatNow: 'Was möchtest du machen?',
  fed: 'Lecker, danke!',
  full: 'Satt und froh! Morgen gibt es den nächsten Snack.',
  feedFailed: 'Mmh, der Snack klappt gerade nicht. Wir versuchen es später noch einmal.',
  laterThen: 'Okay, dann vielleicht später.',
  maxLevel: 'Du hast das höchste Level erreicht. Toll gemacht!',
  noTasks: 'Du hast gerade keine Aufgaben von deiner Lehrerin.',
  noClass: 'Du bist noch in keiner Klasse. Darum hast du auch keine Aufgaben von der Schule.',
  tasksIntro: 'Das hat deine Lehrerin dir aufgegeben.',
  notNow: 'Das weiß ich gerade nicht. Frag mich gleich noch einmal.',
  soon: 'Bald kann ich dir hier auch dabei helfen.',
  options: 'Du kannst sagen füttern, welches Level habe ich, oder was habe ich auf.',
  helpFeed: 'Sag ja, dann bekomme ich meinen Snack. Oder sag nein.',
  notUnderstood: 'Das habe ich nicht verstanden. Sag es bitte noch einmal.',
  bye: 'Tschüss, bis bald!',
  unavailable: 'Ich bin gleich wieder für dich da. Versuch es bitte später noch einmal.',
} as const;

/** „Du hast … bekommen.“ for the stars a snack gives, as fixed lines; other counts use Alexa's voice. */
export const STARS_GAINED_LINES: Readonly<Record<number, string>> = {
  1: 'Du hast einen Stern bekommen.',
  2: 'Du hast zwei Sterne bekommen.',
  3: 'Du hast drei Sterne bekommen.',
  4: 'Du hast vier Sterne bekommen.',
  5: 'Du hast fünf Sterne bekommen.',
  10: 'Du hast zehn Sterne bekommen.',
};

/** „Level {n}! Juhu!“ (`progression.feed.says.levelUp`) for every level after the first. */
export const LEVEL_UP_LINES: Readonly<Record<number, string>> = {
  2: 'Level 2! Juhu!',
  3: 'Level 3! Juhu!',
  4: 'Level 4! Juhu!',
  5: 'Level 5! Juhu!',
  6: 'Level 6! Juhu!',
};
