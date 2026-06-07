export const ALL_STICKERS = [
  { id:1,  series:'cosmic', name:'Nebula Cat',   emoji:'🐱', rarity:'legendary', bg:'#4C1D95' },
  { id:2,  series:'cosmic', name:'Star Pup',     emoji:'🐶', rarity:'rare',      bg:'#5B21B6' },
  { id:3,  series:'cosmic', name:'Moon Bunny',   emoji:'🐰', rarity:'common',    bg:'#6D28D9' },
  { id:4,  series:'cosmic', name:'Galaxy Fox',   emoji:'🦊', rarity:'epic',      bg:'#4C1D95' },
  { id:5,  series:'cosmic', name:'Comet Bird',   emoji:'🦜', rarity:'common',    bg:'#7C3AED' },
  { id:6,  series:'cosmic', name:'Void Fish',    emoji:'🐠', rarity:'rare',      bg:'#5B21B6' },
  { id:7,  series:'dino',   name:'T-Rex Tiny',   emoji:'🦖', rarity:'epic',      bg:'#064E3B' },
  { id:8,  series:'dino',   name:'Ptero Pete',   emoji:'🦅', rarity:'common',    bg:'#065F46' },
  { id:9,  series:'dino',   name:'Stego Sam',    emoji:'🐊', rarity:'rare',      bg:'#047857' },
  { id:10, series:'dino',   name:'Raptor Raj',   emoji:'🦎', rarity:'legendary', bg:'#064E3B' },
  { id:11, series:'dino',   name:'Bronto Bo',    emoji:'🐢', rarity:'common',    bg:'#065F46' },
  { id:12, series:'dino',   name:'Anky Ana',     emoji:'🦕', rarity:'rare',      bg:'#047857' },
  { id:13, series:'robot',  name:'Bolt Bot',     emoji:'⚡', rarity:'rare',      bg:'#0C4A6E' },
  { id:14, series:'robot',  name:'Nano Ned',     emoji:'🤖', rarity:'common',    bg:'#075985' },
  { id:15, series:'robot',  name:'Circuit Cee',  emoji:'💡', rarity:'epic',      bg:'#0369A1' },
  { id:16, series:'robot',  name:'Giga Gus',     emoji:'🔧', rarity:'legendary', bg:'#0C4A6E' },
  { id:17, series:'robot',  name:'Pixel Pat',    emoji:'🕹️', rarity:'common',    bg:'#075985' },
  { id:18, series:'robot',  name:'Data Dan',     emoji:'💾', rarity:'rare',      bg:'#0369A1' },
  { id:19, series:'magic',  name:'Fire Witch',   emoji:'🧙', rarity:'legendary', bg:'#7F1D1D' },
  { id:20, series:'magic',  name:'Ice Drake',    emoji:'🐲', rarity:'epic',      bg:'#991B1B' },
  { id:21, series:'magic',  name:'Storm Sprite', emoji:'🌪️', rarity:'rare',      bg:'#B91C1C' },
  { id:22, series:'magic',  name:'Potion Pup',   emoji:'🧪', rarity:'common',    bg:'#7F1D1D' },
  { id:23, series:'magic',  name:'Rune Bear',    emoji:'🐻', rarity:'rare',      bg:'#991B1B' },
  { id:24, series:'magic',  name:'Shadow Owl',   emoji:'🦉', rarity:'common',    bg:'#B91C1C' },
]

export const SERIES = [
  { id:'cosmic', name:'Cosmic Crew', emoji:'🌌', color:'#7C3AED' },
  { id:'dino',   name:'Dino Gang',   emoji:'🦕', color:'#059669' },
  { id:'robot',  name:'Robo Pals',   emoji:'🤖', color:'#0284C7' },
  { id:'magic',  name:'Spell Craft', emoji:'✨', color:'#DC2626' },
]

export const RARITY = {
  common:    { label:'Common',    color:'#94A3B8', stars:1 },
  rare:      { label:'Rare',      color:'#60A5FA', stars:2 },
  epic:      { label:'Epic',      color:'#A78BFA', stars:3 },
  legendary: { label:'Legendary', color:'#FCD34D', stars:4 },
}

export const PACK_COST = 50

export function rollPack() {
  const result = []
  const used = new Set()
  for (let i = 0; i < 5; i++) {
    const roll = Math.random() * 100
    const rarity = roll < 5 ? 'legendary' : roll < 20 ? 'epic' : roll < 50 ? 'rare' : 'common'
    const pool = ALL_STICKERS.filter(s => s.rarity === rarity && !used.has(s.id))
    const pick = pool.length
      ? pool[Math.floor(Math.random() * pool.length)]
      : ALL_STICKERS.filter(s => !used.has(s.id))[0]
    used.add(pick.id)
    result.push(pick)
  }
  return result
}
