/* eslint-disable no-console */
/**
 * One-shot sync that writes IMDB Top 250 video-game rankings into the Game table.
 *
 * Source: imdb.com/list/ls097840768/ (top 250 rated by users), sorted by
 * popularity descending and rating descending. Lists hand-extracted from
 * the IMDB UI on 2026-05-29.
 *
 * Usage:
 *   node backend/scripts/syncImdbRanks.js
 *
 * Match strategy: normalize title to lowercase + alphanumerics, then look
 * for an exact match by normalized title in the Game table. When there are
 * multiple matches, prefer one with a matching release year ±1, falling
 * back to the row whose averageRating is closest to the IMDB rating.
 */

require('dotenv').config()

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

/* ─────────────────── POPULARITY LIST (ascending rank, 1 = most popular) ─────────────────── */

const POPULARITY = [
  ['Grand Theft Auto V', 2013],
  ['Red Dead Redemption II', 2018],
  ['Detroit: Become Human', 2018],
  ['Dispatch', 2025],
  ['Grand Theft Auto: San Andreas', 2004],
  ['Cyberpunk 2077', 2020],
  ['The Last of Us', 2013],
  ['Death Stranding 2: On the Beach', 2025],
  ['Uncharted 4: A Thief’s End', 2016],
  ['Clair Obscur: Expedition 33', 2025],
  ['Elden Ring', 2022],
  ['Death Stranding', 2019],
  ['Grand Theft Auto: Vice City', 2002],
  ['Spider-Man 2', 2023],
  ['Star Wars Jedi: Survivor', 2023],
  ['Red Dead Redemption', 2010],
  ['The Last of Us: Part II', 2020],
  ['God of War: Ragnarök', 2022],
  ['Resident Evil 4', 2023],
  ['Ghost of Tsushima', 2020],
  ['The Witcher 3: Wild Hunt', 2015],
  ['The Elder Scrolls V: Skyrim', 2011],
  ['Baldur’s Gate III', 2023],
  ['L.A. Noire', 2011],
  ['Kingdom Come: Deliverance II', 2025],
  ['Ghost of Yōtei', 2025],
  ['Batman: Arkham Knight', 2015],
  ['Grand Theft Auto IV', 2008],
  ['Batman: Arkham City', 2011],
  ['Resident Evil 4', 2005],
  ['Until Dawn', 2015],
  ['Resident Evil Village', 2021],
  ['Horizon Zero Dawn', 2017],
  ['Resident Evil 2', 2019],
  ['Spider-Man', 2018],
  ['Far Cry 3', 2012],
  ['The Walking Dead: A Telltale Game Series', 2012],
  ['God of War III', 2010],
  ['Call of Duty: Modern Warfare 2', 2009],
  ['Indiana Jones and the Great Circle', 2024],
  ['Cyberpunk 2077: Phantom Liberty', 2023],
  ['Resident Evil 7: Biohazard', 2017],
  ['Alan Wake II', 2023],
  ['God of War', 2018],
  ['The Legend of Zelda: Tears of the Kingdom', 2023],
  ['Bloodborne', 2015],
  ['God of War', 2005],
  ['Super Mario Odyssey', 2017],
  ['The Legend of Zelda: Breath of the Wild', 2017],
  ['Mass Effect', 2007],
  ['Horizon Forbidden West', 2022],
  ['Super Mario Galaxy', 2007],
  ['Silent Hill 2', 2024],
  ['NieR: Automata', 2017],
  ['Grand Theft Auto III', 2001],
  ['Fallout: New Vegas', 2010],
  ['Doom Eternal', 2020],
  ['Assassin’s Creed IV: Black Flag', 2013],
  ['Disco Elysium', 2019],
  ['Uncharted 2: Among Thieves', 2009],
  ['Portal 2', 2011],
  ['Fallout 2: A Post-Nuclear Role-Playing Game', 1998],
  ['Heavy Rain', 2010],
  ['Sekiro: Shadows Die Twice', 2019],
  ['Tomb Raider', 2013],
  ['God of War II', 2007],
  ['Need for Speed: Most Wanted', 2005],
  ['Batman: Arkham Asylum', 2009],
  ['Fallout 3', 2008],
  ['Uncharted 3: Drake’s Deception', 2011],
  ['The Legend of Zelda: Ocarina of Time', 1998],
  ['Persona 5', 2016],
  ['Mass Effect 2', 2010],
  ['Assassin’s Creed: Brotherhood', 2010],
  ['Super Smash Bros. Ultimate', 2018],
  ['Super Mario Galaxy 2', 2010],
  ['Final Fantasy VII', 1997],
  ['Final Fantasy VII Remake', 2020],
  ['Cuphead', 2017],
  ['The Legend of Zelda: Twilight Princess', 2006],
  ['Super Mario Bros. 3', 1988],
  ['Life Is Strange', 2015],
  ['Diablo II', 2000],
  ['Super Smash Bros. Brawl', 2008],
  ['Assassin’s Creed II', 2009],
  ['Star Wars: Knights of the Old Republic', 2003],
  ['Mass Effect 3', 2012],
  ['Silent Hill 2', 2001],
  ['Metal Gear Solid 3: Snake Eater', 2004],
  ['Bully', 2006],
  ['Minecraft', 2009],
  ['Alien: Isolation', 2014],
  ['Kingdom Hearts II', 2005],
  ['Final Fantasy X', 2001],
  ['Max Payne', 2001],
  ['Call of Duty 4: Modern Warfare', 2007],
  ['Dragon Age: Origins', 2009],
  ['Metal Gear Solid 4: Guns of the Patriots', 2008],
  ['Portal', 2007],
  ['Divinity: Original Sin II', 2017],
  ['Halo 3', 2007],
  ['Hollow Knight: Silksong', 2025],
  ['Star Wars: Battlefront II', 2005],
  ['The Elder Scrolls IV: Oblivion', 2006],
  ['Super Mario 64', 1996],
  ['Ratchet & Clank: Rift Apart', 2021],
  ['Super Mario World', 1990],
  ['Resident Evil 3: Nemesis', 1999],
  ['Outer Wilds', 2019],
  ['Astro Bot', 2024],
  ['Prince of Persia: Warrior Within', 2004],
  ['The Legend of Zelda: Majora’s Mask', 2000],
  ['Baldur’s Gate II: Shadows of Amn', 2000],
  ['Shin Megami Tensei: Persona 4', 2008],
  ['Final Fantasy IX', 2000],
  ['The Legend of Zelda: A Link to the Past', 1991],
  ['Final Fantasy VIII', 1999],
  ['Paper Mario: The Thousand-Year Door', 2004],
  ['It Takes Two', 2021],
  ['Kingdom Hearts', 2002],
  ['Final Fantasy VII Rebirth', 2024],
  ['Metal Gear Solid', 1998],
  ['Split Fiction', 2025],
  ['BioShock', 2007],
  ['Metal Gear Solid V: The Phantom Pain', 2015],
  ['Black Myth: Wukong', 2024],
  ['Halo 2', 2004],
  ['BioShock Infinite', 2013],
  ['Resident Evil 2', 1998],
  ['Hades', 2018],
  ['Half-Life 2', 2004],
  ['Undertale', 2015],
  ['Metal Gear Solid 2: Sons of Liberty', 2001],
  ['The Chronicles of Riddick: Escape from Butcher Bay', 2004],
  ['The Wolf Among Us', 2013],
  ['Resident Evil', 1996],
  ['Hollow Knight', 2017],
  ['Max Payne 3', 2012],
  ['Dark Souls III', 2016],
  ['Star Wars: Knights of the Old Republic II - The Sith Lords', 2004],
  ['Dark Souls', 2011],
  ['Half-Life', 1998],
  ['Borderlands 2', 2012],
  ['Silent Hill', 1999],
  ['Silent Hill 3', 2003],
  ['Halo: Combat Evolved', 2001],
  ['Dead Space', 2023],
  ['Command & Conquer: Red Alert 2', 2000],
  ['Max Payne 2: The Fall of Max Payne', 2003],
  ['Halo: Reach', 2010],
  ['Vampire: The Masquerade - Bloodlines', 2004],
  ['Omori', 2020],
  ['The Warriors', 2005],
  ['Yakuza 0', 2015],
  ['Deltarune', 2018],
  ['P.T.', 2014],
  ['Shadow of the Colossus', 2005],
  ['Hitman: Blood Money', 2006],
  ['The Walking Dead: Season Two', 2013],
  ['Dead Space', 2008],
  ['Fire Emblem: Three Houses', 2019],
  ['Fallout', 1997],
  ['Grim Fandango', 1998],
  ['Super Mario Bros.', 1985],
  ['Mafia: The City of Lost Heaven', 2002],
  ['The Walking Dead: The Final Season', 2018],
  ['South Park: The Stick of Truth', 2014],
  ['Resident Evil', 2002],
  ['Conker’s Bad Fur Day', 2001],
  ['Kingdom Hearts: Birth by Sleep', 2010],
  ['Tales from the Borderlands', 2014],
  ['Castlevania: Symphony of the Night', 1997],
  ['StarCraft II: Wings of Liberty', 2010],
  ['The Witcher 2: Assassins of Kings', 2011],
  ['Deus Ex', 2000],
  ['Chrono Trigger', 1995],
  ['Half-Life: Alyx', 2020],
  ['Inside', 2016],
  ['Dead Space 2', 2011],
  ['Tom Clancy’s Splinter Cell: Chaos Theory', 2005],
  ['Warcraft III: Reign of Chaos', 2002],
  ['StarCraft', 1998],
  ['GoldenEye 007', 1997],
  ['Ico', 2001],
  ['Psychonauts', 2005],
  ['Resident Evil 4: Separate Ways', 2023],
  ['Sly 3: Honor Among Thieves', 2005],
  ['Dragon Ball Z: Budokai Tenkaichi 3', 2007],
  ['Doom', 1993],
  ['Blade Runner', 1997],
  ['The Secret of Monkey Island', 1990],
  ['Sly 2: Band of Thieves', 2004],
  ['The Curse of Monkey Island', 1997],
  ['Broken Sword: Circle of Blood', 1996],
  ['StarCraft II: Legacy of the Void', 2015],
  ['Ratchet & Clank: Up Your Arsenal', 2004],
  ['The Lord of the Rings: The Battle for Middle-Earth', 2004],
  ['Planescape: Torment', 1999],
  ['Final Fantasy VI', 1994],
  ['Crash Team Racing', 1999],
  ['Baldur’s Gate', 1998],
  ['Ori and the Will of the Wisps', 2020],
  ['Horizon Zero Dawn: The Frozen Wilds', 2017],
  ['Okami', 2006],
  ['Crash Bandicoot: Warped', 1998],
  ['Celeste', 2018],
  ['Metal Gear Solid: The Twin Snakes', 2004],
  ['The Legend of Zelda: The Wind Waker', 2002],
  ['Gears of War 2', 2008],
  ['Super Metroid', 1994],
  ['Half-Life 2: Episode Two', 2007],
  ['Indiana Jones and the Fate of Atlantis', 1992],
  ['Donkey Kong Country', 1994],
  ['EarthBound', 1994],
  ['Shenmue', 1999],
  ['Fire Emblem: Awakening', 2012],
  ['Perfect Dark', 2000],
  ['Pokémon: Red Version', 1996],
  ['Age of Empires II: The Age of Kings', 1999],
  ['Mario Kart 64', 1996],
  ['Half-Life 2: Episode One', 2006],
  ['StarCraft: Brood War', 1998],
  ['Day of the Tentacle', 1993],
  ['BioShock Infinite: Burial at Sea - Episode One', 2013],
  ['System Shock 2', 1999],
  ['Metroid Prime', 2002],
  ['Super Mario RPG: Legend of the Seven Stars', 1996],
  ['Shin Megami Tensei: Persona 3', 2006],
  ['Pokémon Emerald Version', 2004],
  ['Undying', 2001],
  ['StarCraft II: Heart of the Swarm', 2013],
  ['Civilization IV', 2005],
  ['Medieval II: Total War', 2006],
  ['Baldur’s Gate II: Throne of Bhaal', 2001],
  ['The Longest Journey', 1999],
  ['Monkey Island 2: LeChuck’s Revenge', 1991],
  ['Banjo-Kazooie', 1998],
  ['The Legend of Zelda: A Link Between Worlds', 2013],
  ['Heroes of Might and Magic III: The Restoration of Erathia', 1999],
  ['Sam and Max Hit the Road', 1993],
  ['Donkey Kong Country 2: Diddy’s Kong Quest', 1995],
  ['Rome: Total War', 2004],
  ['Chrono Cross', 1999],
  ['Pokémon Crystal Version', 2000],
  ['Civilization II', 1996],
  ['Pokémon Silver Version', 1999],
  ['Pokémon Gold Version', 1999],
  ['Pokémon: Yellow Version - Special Pikachu Edition', 1998],
  ['Metal Gear: Ghost Babel', 2000],
  ['Pokémon: Blue Version', 1996],
]

/* ─────────────────── RATING LIST (1 = highest IMDB rating) ─────────────────── */

const RATINGS = [
  ['Red Dead Redemption II', 2018, 9.8],
  ['The Last of Us', 2013, 9.7],
  ['Clair Obscur: Expedition 33', 2025, 9.6],
  ['The Witcher 3: Wild Hunt', 2015, 9.6],
  ['Baldur’s Gate III', 2023, 9.6],
  ['The Legend of Zelda: Ocarina of Time', 1998, 9.6],
  ['God of War: Ragnarök', 2022, 9.5],
  ['God of War', 2018, 9.5],
  ['Mass Effect 2', 2010, 9.5],
  ['Final Fantasy VII', 1997, 9.5],
  ['Star Wars: Knights of the Old Republic', 2003, 9.5],
  ['Metal Gear Solid 3: Snake Eater', 2004, 9.5],
  ['Metal Gear Solid', 1998, 9.5],
  ['Grand Theft Auto V', 2013, 9.4],
  ['Grand Theft Auto: San Andreas', 2004, 9.4],
  ['Uncharted 4: A Thief’s End', 2016, 9.4],
  ['Elden Ring', 2022, 9.4],
  ['Red Dead Redemption', 2010, 9.4],
  ['Kingdom Come: Deliverance II', 2025, 9.4],
  ['Batman: Arkham City', 2011, 9.4],
  ['The Legend of Zelda: Tears of the Kingdom', 2023, 9.4],
  ['The Legend of Zelda: Breath of the Wild', 2017, 9.4],
  ['Portal 2', 2011, 9.4],
  ['Fallout 2: A Post-Nuclear Role-Playing Game', 1998, 9.4],
  ['Silent Hill 2', 2001, 9.4],
  ['Baldur’s Gate II: Shadows of Amn', 2000, 9.4],
  ['Half-Life 2', 2004, 9.4],
  ['Chrono Trigger', 1995, 9.4],
  ['Death Stranding 2: On the Beach', 2025, 9.3],
  ['Resident Evil 4', 2023, 9.3],
  ['The Elder Scrolls V: Skyrim', 2011, 9.3],
  ['Cyberpunk 2077: Phantom Liberty', 2023, 9.3],
  ['Uncharted 2: Among Thieves', 2009, 9.3],
  ['Kingdom Hearts II', 2005, 9.3],
  ['Metal Gear Solid 4: Guns of the Patriots', 2008, 9.3],
  ['The Secret of Monkey Island', 1990, 9.3],
  ['Planescape: Torment', 1999, 9.3],
  ['Dispatch', 2025, 9.2],
  ['Grand Theft Auto: Vice City', 2002, 9.2],
  ['Ghost of Tsushima', 2020, 9.2],
  ['Resident Evil 4', 2005, 9.2],
  ['The Walking Dead: A Telltale Game Series', 2012, 9.2],
  ['Bloodborne', 2015, 9.2],
  ['Persona 5', 2016, 9.2],
  ['Super Mario Bros. 3', 1988, 9.2],
  ['Max Payne', 2001, 9.2],
  ['Super Mario World', 1990, 9.2],
  ['Astro Bot', 2024, 9.2],
  ['The Legend of Zelda: A Link to the Past', 1991, 9.2],
  ['P.T.', 2014, 9.2],
  ['Half-Life: Alyx', 2020, 9.2],
  ['Monkey Island 2: LeChuck’s Revenge', 1991, 9.2],
  ['Detroit: Become Human', 2018, 9.1],
  ['Spider-Man', 2018, 9.1],
  ['God of War III', 2010, 9.1],
  ['Alan Wake II', 2023, 9.1],
  ['Mass Effect', 2007, 9.1],
  ['Super Mario Galaxy', 2007, 9.1],
  ['Silent Hill 2', 2024, 9.1],
  ['God of War II', 2007, 9.1],
  ['Batman: Arkham Asylum', 2009, 9.1],
  ['Mass Effect 3', 2012, 9.1],
  ['Final Fantasy X', 2001, 9.1],
  ['Dragon Age: Origins', 2009, 9.1],
  ['Hollow Knight: Silksong', 2025, 9.1],
  ['Super Mario 64', 1996, 9.1],
  ['Shin Megami Tensei: Persona 4', 2008, 9.1],
  ['It Takes Two', 2021, 9.1],
  ['Kingdom Hearts', 2002, 9.1],
  ['BioShock', 2007, 9.1],
  ['BioShock Infinite', 2013, 9.1],
  ['Resident Evil 2', 1998, 9.1],
  ['Dark Souls III', 2016, 9.1],
  ['Half-Life', 1998, 9.1],
  ['Shadow of the Colossus', 2005, 9.1],
  ['Fallout', 1997, 9.1],
  ['Grim Fandango', 1998, 9.1],
  ['Mafia: The City of Lost Heaven', 2002, 9.1],
  ['Castlevania: Symphony of the Night', 1997, 9.1],
  ['Deus Ex', 2000, 9.1],
  ['StarCraft', 1998, 9.1],
  ['GoldenEye 007', 1997, 9.1],
  ['The Curse of Monkey Island', 1997, 9.1],
  ['Final Fantasy VI', 1994, 9.1],
  ['Super Metroid', 1994, 9.1],
  ['Half-Life 2: Episode Two', 2007, 9.1],
  ['Spider-Man 2', 2023, 9.0],
  ['Ghost of Yōtei', 2025, 9.0],
  ['Batman: Arkham Knight', 2015, 9.0],
  ['Resident Evil 2', 2019, 9.0],
  ['God of War', 2005, 9.0],
  ['Super Mario Odyssey', 2017, 9.0],
  ['Disco Elysium', 2019, 9.0],
  ['Sekiro: Shadows Die Twice', 2019, 9.0],
  ['Fallout 3', 2008, 9.0],
  ['Uncharted 3: Drake’s Deception', 2011, 9.0],
  ['Super Mario Galaxy 2', 2010, 9.0],
  ['The Legend of Zelda: Twilight Princess', 2006, 9.0],
  ['Diablo II', 2000, 9.0],
  ['Assassin’s Creed II', 2009, 9.0],
  ['Call of Duty 4: Modern Warfare', 2007, 9.0],
  ['Portal', 2007, 9.0],
  ['The Legend of Zelda: Majora’s Mask', 2000, 9.0],
  ['Final Fantasy VII Rebirth', 2024, 9.0],
  ['Split Fiction', 2025, 9.0],
  ['Metal Gear Solid 2: Sons of Liberty', 2001, 9.0],
  ['Dark Souls', 2011, 9.0],
  ['Silent Hill', 1999, 9.0],
  ['Max Payne 2: The Fall of Max Payne', 2003, 9.0],
  ['Vampire: The Masquerade - Bloodlines', 2004, 9.0],
  ['Omori', 2020, 9.0],
  ['Resident Evil', 2002, 9.0],
  ['Ori and the Will of the Wisps', 2020, 9.0],
  ['The Legend of Zelda: The Wind Waker', 2002, 9.0],
  ['Indiana Jones and the Fate of Atlantis', 1992, 9.0],
  ['StarCraft: Brood War', 1998, 9.0],
  ['Baldur’s Gate II: Throne of Bhaal', 2001, 9.0],
  ['Heroes of Might and Magic III: The Restoration of Erathia', 1999, 9.0],
  ['Metal Gear: Ghost Babel', 2000, 9.0],
  ['Grand Theft Auto IV', 2008, 8.9],
  ['Horizon Zero Dawn', 2017, 8.9],
  ['Fallout: New Vegas', 2010, 8.9],
  ['Final Fantasy VII Remake', 2020, 8.9],
  ['The Elder Scrolls IV: Oblivion', 2006, 8.9],
  ['Paper Mario: The Thousand-Year Door', 2004, 8.9],
  ['Hollow Knight', 2017, 8.9],
  ['Star Wars: Knights of the Old Republic II - The Sith Lords', 2004, 8.9],
  ['Yakuza 0', 2015, 8.9],
  ['Fire Emblem: Three Houses', 2019, 8.9],
  ['Warcraft III: Reign of Chaos', 2002, 8.9],
  ['Broken Sword: Circle of Blood', 1996, 8.9],
  ['Metal Gear Solid: The Twin Snakes', 2004, 8.9],
  ['EarthBound', 1994, 8.9],
  ['Shenmue', 1999, 8.9],
  ['Day of the Tentacle', 1993, 8.9],
  ['System Shock 2', 1999, 8.9],
  ['Shin Megami Tensei: Persona 3', 2006, 8.9],
  ['The Longest Journey', 1999, 8.9],
  ['Star Wars Jedi: Survivor', 2023, 8.8],
  ['The Last of Us: Part II', 2020, 8.8],
  ['Far Cry 3', 2012, 8.8],
  ['Call of Duty: Modern Warfare 2', 2009, 8.8],
  ['Indiana Jones and the Great Circle', 2024, 8.8],
  ['Horizon Forbidden West', 2022, 8.8],
  ['NieR: Automata', 2017, 8.8],
  ['Super Smash Bros. Ultimate', 2018, 8.8],
  ['Life Is Strange', 2015, 8.8],
  ['Minecraft', 2009, 8.8],
  ['Halo 3', 2007, 8.8],
  ['Star Wars: Battlefront II', 2005, 8.8],
  ['Final Fantasy IX', 2000, 8.8],
  ['Hades', 2018, 8.8],
  ['Undertale', 2015, 8.8],
  ['The Wolf Among Us', 2013, 8.8],
  ['Resident Evil', 1996, 8.8],
  ['Halo: Combat Evolved', 2001, 8.8],
  ['Dead Space', 2023, 8.8],
  ['The Warriors', 2005, 8.8],
  ['Dead Space', 2008, 8.8],
  ['Super Mario Bros.', 1985, 8.8],
  ['South Park: The Stick of Truth', 2014, 8.8],
  ['Tales from the Borderlands', 2014, 8.8],
  ['StarCraft II: Wings of Liberty', 2010, 8.8],
  ['Dead Space 2', 2011, 8.8],
  ['Blade Runner', 1997, 8.8],
  ['Baldur’s Gate', 1998, 8.8],
  ['Okami', 2006, 8.8],
  ['Pokémon: Red Version', 1996, 8.8],
  ['Age of Empires II: The Age of Kings', 1999, 8.8],
  ['Metroid Prime', 2002, 8.8],
  ['Civilization II', 1996, 8.8],
  ['Pokémon Silver Version', 1999, 8.8],
  ['Pokémon Gold Version', 1999, 8.8],
]

/* ─────────────────── Title normalization & matching ─────────────────── */

const ROMAN_TO_INT = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15 }

// Suffixes catalog rows often add (Director's Cut, Remastered, Definitive...) that the IMDB list doesn't carry
const STRIP_SUFFIX_RE = new RegExp(
  [
    'remastered',
    're?-?master(ed)?',
    'director ?s? cut',
    'definitive edition',
    'definitive',
    'complete edition',
    'goty( edition)?',
    'game of the year( edition)?',
    'enhanced edition',
    'enhanced',
    'gold edition',
    'deluxe edition',
    'royal',
    'anniversary edition',
    'anniversary',
    'special edition',
    'ultimate edition',
    'collector ?s? edition',
    'legendary edition',
    'platinum edition',
    'redux',
  ].map((s) => `(?:[ -]+${s})`).join('|') + '$',
  'i'
)

function normalizeTitle(title) {
  // 1. Lowercase + strip diacritics + canonicalize quotes/dashes
  let s = String(title || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/&/g, ' and ')

  // 2. Collapse all non-alphanumerics to single spaces — apostrophes,
  // colons, commas, dashes all become whitespace
  s = s.replace(/[^a-z0-9]+/g, ' ').trim()

  // 3. Strip trailing edition qualifiers (now operating on clean text)
  let prev
  do {
    prev = s
    s = s.replace(STRIP_SUFFIX_RE, '').trim()
  } while (s !== prev)

  // 4. Convert standalone roman numerals to digits (not the first token,
  // so titles that ARE roman numerals like "X" or "Civilization II" still work)
  const tokens = s.split(/\s+/).filter(Boolean)
  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i]
    if (ROMAN_TO_INT[t] !== undefined) tokens[i] = String(ROMAN_TO_INT[t])
  }

  return tokens.join(' ')
}

async function buildTitleIndex() {
  const rows = await prisma.game.findMany({
    select: { id: true, slug: true, title: true, year: true, averageRating: true },
  })

  const byNormTitle = new Map()
  for (const row of rows) {
    const key = normalizeTitle(row.title)
    if (!key) continue
    if (!byNormTitle.has(key)) byNormTitle.set(key, [])
    byNormTitle.get(key).push({ ...row, normTitle: key })
  }
  return { rows, byNormTitle }
}

function findCandidates(byNormTitle, normQuery) {
  // 1. Exact match
  const exact = byNormTitle.get(normQuery)
  if (exact && exact.length > 0) return exact

  // 2. Prefix match (catalog title starts with the IMDB title, e.g.
  //    "Ghost of Tsushima Directors Cut" matches IMDB "Ghost of Tsushima")
  const prefixHits = []
  const queryWords = normQuery.split(' ').length
  for (const [key, rows] of byNormTitle) {
    if (key === normQuery) continue
    if (key.startsWith(normQuery + ' ')) {
      // require IMDB title to be at least 2 words to avoid noisy matches
      // (e.g., "Doom" matching "Doom Eternal", "Doom 3" etc.)
      if (queryWords >= 2) prefixHits.push(...rows)
    }
  }
  if (prefixHits.length > 0) return prefixHits

  // 3. Reverse prefix (catalog title is a prefix of the IMDB title, e.g.
  //    catalog "Metal Gear Solid 3" matches IMDB "Metal Gear Solid 3 Snake Eater")
  const reverseHits = []
  for (const [key, rows] of byNormTitle) {
    if (key === normQuery) continue
    if (normQuery.startsWith(key + ' ') && key.split(' ').length >= 3) {
      reverseHits.push(...rows)
    }
  }
  return reverseHits
}

function pickBestMatch(candidates, { year, imdbRating }) {
  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0]

  // Prefer year match within ±1
  const yearHit = year
    ? candidates.find((c) => c.year && Math.abs(c.year - year) <= 1)
    : null
  if (yearHit) return yearHit

  // Otherwise prefer the row whose averageRating is closest to the IMDB rating
  if (imdbRating != null) {
    return candidates
      .slice()
      .sort((a, b) => {
        const da = a.averageRating == null ? 99 : Math.abs(a.averageRating - imdbRating)
        const db = b.averageRating == null ? 99 : Math.abs(b.averageRating - imdbRating)
        return da - db
      })[0]
  }

  return candidates[0]
}

/* ─────────────────── Sync ─────────────────── */

async function syncImdbRanks() {
  console.log('Building title index from Game table…')
  const { rows, byNormTitle } = await buildTitleIndex()
  console.log(`Indexed ${rows.length} games into ${byNormTitle.size} unique normalized titles.`)

  // Rating ranks first so the imdbRating column gets the canonical score
  const rankingsByGameId = new Map() // id -> { ratingRank?, popularityRank?, imdbRating? }
  const missing = { rating: [], popularity: [] }

  RATINGS.forEach(([title, year, rating], idx) => {
    const norm = normalizeTitle(title)
    const candidates = findCandidates(byNormTitle, norm)
    const match = pickBestMatch(candidates, { year, imdbRating: rating })
    if (!match) {
      missing.rating.push({ rank: idx + 1, title, year })
      return
    }
    const existing = rankingsByGameId.get(match.id) || {}
    existing.imdbRatingRank = idx + 1
    existing.imdbRating = rating
    rankingsByGameId.set(match.id, existing)
  })

  POPULARITY.forEach(([title, year], idx) => {
    const norm = normalizeTitle(title)
    const candidates = findCandidates(byNormTitle, norm)
    const match = pickBestMatch(candidates, { year })
    if (!match) {
      missing.popularity.push({ rank: idx + 1, title, year })
      return
    }
    const existing = rankingsByGameId.get(match.id) || {}
    existing.imdbPopularityRank = idx + 1
    rankingsByGameId.set(match.id, existing)
  })

  console.log(`Matched ${rankingsByGameId.size} unique games across both lists.`)
  console.log(`Missing from rating list: ${missing.rating.length}, popularity: ${missing.popularity.length}`)

  // Clear any prior ranks so we don't keep stale state
  await prisma.game.updateMany({
    data: { imdbRatingRank: null, imdbPopularityRank: null, imdbRating: null },
    where: {
      OR: [
        { imdbRatingRank: { not: null } },
        { imdbPopularityRank: { not: null } },
        { imdbRating: { not: null } },
      ],
    },
  })

  // Batch updates in transactions of 50
  const ids = Array.from(rankingsByGameId.keys())
  const batchSize = 50
  let written = 0
  for (let i = 0; i < ids.length; i += batchSize) {
    const slice = ids.slice(i, i + batchSize)
    await prisma.$transaction(
      slice.map((id) => {
        const r = rankingsByGameId.get(id)
        return prisma.game.update({
          where: { id },
          data: {
            imdbRatingRank: r.imdbRatingRank ?? null,
            imdbPopularityRank: r.imdbPopularityRank ?? null,
            imdbRating: r.imdbRating ?? null,
          },
        })
      })
    )
    written += slice.length
  }

  console.log(`Wrote IMDB ranks for ${written} games.`)
  if (missing.rating.length > 0) {
    console.log('\nUnmatched rating entries:')
    missing.rating.slice(0, 30).forEach((m) => console.log(`  #${m.rank} ${m.title} (${m.year})`))
    if (missing.rating.length > 30) console.log(`  …and ${missing.rating.length - 30} more`)
  }
  if (missing.popularity.length > 0) {
    console.log('\nUnmatched popularity entries:')
    missing.popularity.slice(0, 30).forEach((m) => console.log(`  #${m.rank} ${m.title} (${m.year})`))
    if (missing.popularity.length > 30) console.log(`  …and ${missing.popularity.length - 30} more`)
  }
}

syncImdbRanks()
  .catch((err) => {
    console.error('Sync failed:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
