// Shared Mini Games catalog. Server chooses rules from this list only.
// An event becomes ready when enough distinct people RSVP; readiness is NOT a
// claim that any sports gameplay, official scoring or rewards already exist.
export const MINI_GAMES=Object.freeze([
  {id:'football',name:'Football',category:'Team Sports',icon:'🏈',minPlayers:10,maxPlayers:22,arena:'gridiron',description:'Two-team field and end zones'},
  {id:'soccer',name:'Soccer',category:'Team Sports',icon:'⚽',minPlayers:10,maxPlayers:22,arena:'pitch',description:'Full pitch and goals'},
  {id:'basketball',name:'Basketball',category:'Team Sports',icon:'🏀',minPlayers:4,maxPlayers:10,arena:'court',description:'Two hoops and hardwood'},
  {id:'tennis',name:'Tennis',category:'Racket Sports',icon:'🎾',minPlayers:2,maxPlayers:4,arena:'tennis',description:'Singles or doubles court'},
  {id:'chess',name:'Chess',category:'Tabletop',icon:'♟️',minPlayers:2,maxPlayers:2,arena:'chess',description:'Head-to-head strategy board'},
  {id:'checkers',name:'Checkers',category:'Tabletop',icon:'🔴',minPlayers:2,maxPlayers:2,arena:'checkers',description:'Classic capture and crowns'},
  {id:'palm-clash',name:'Palm Clash',category:'Arena Challenges',icon:'✋',minPlayers:2,maxPlayers:2,arena:'palm-clash',description:'Original turn-based palm-strike challenge'},
  {id:'sumo',name:'Sumo Wrestling',category:'Arena Challenges',icon:'🥋',minPlayers:2,maxPlayers:2,arena:'sumo',description:'Circular ring and balance contest'},
  {id:'volleyball',name:'Volleyball',category:'Team Sports',icon:'🏐',minPlayers:4,maxPlayers:12,arena:'volleyball',description:'Net, boundaries and team volleys'},
]);
export const MINI_GAME_IDS=Object.freeze(MINI_GAMES.map(item=>item.id));
const CATALOG=new Map(MINI_GAMES.map(item=>[item.id,item]));
export const miniGameById=id=>CATALOG.get(String(id||''))||null;
export function miniGameReadiness(gameId,entries=[]){
  const game=miniGameById(gameId);
  if(!game)return {players:0,spectators:0,ready:false,remaining:0};
  const unique=new Map();
  for(const entry of entries){
    if(entry?.status==='active' && entry?.user_id){
      unique.set(String(entry.user_id),entry.role==='spectator'?'spectator':'player');
    }
  }
  const players=[...unique.values()].filter(role=>role==='player').length;
  const spectators=[...unique.values()].filter(role=>role==='spectator').length;
  return {players,spectators,ready:players>=game.minPlayers,
    remaining:Math.max(0,game.minPlayers-players),maxPlayers:game.maxPlayers};
}
export function validMiniGameRole(role){return role==='player'||role==='spectator';}
export function miniGameEventOpen(event,now=Date.now()){
  return event && event.status==='open' && Date.parse(event.expires_at)>now;
}
