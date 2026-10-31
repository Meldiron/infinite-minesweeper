export const NICKNAME_PATTERN = /^[a-zA-Z0-9_-]{2,32}$/

const ADJECTIVES = [
  'Swift',
  'Brave',
  'Clever',
  'Lucky',
  'Mighty',
  'Silent',
  'Bold',
  'Quick',
  'Sharp',
  'Keen',
  'Wild',
  'Calm',
  'Fierce',
  'Noble',
  'Sly',
  'Wise',
  'Daring',
  'Nimble',
  'Stealthy',
  'Valiant',
  'Crafty',
  'Agile',
  'Fearless',
]
const NOUNS = [
  'Miner',
  'Seeker',
  'Scout',
  'Hunter',
  'Explorer',
  'Finder',
  'Sweeper',
  'Digger',
  'Tracker',
  'Ranger',
  'Pioneer',
  'Voyager',
  'Pathfinder',
  'Adventurer',
  'Wanderer',
  'Prospector',
  'Surveyor',
  'Navigator',
]
const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)]

export const guestNickname = () =>
  `${pick(ADJECTIVES)}${pick(NOUNS)}${Math.floor(Math.random() * 1000)}`
