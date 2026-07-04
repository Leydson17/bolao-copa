const firebaseConfig = {
  apiKey: "AIzaSyCj_eiMANjippVHI6P85frRuLAyAQPVwiQ",
  authDomain: "bolao-copa-5d5c4.firebaseapp.com",
  databaseURL: "https://bolao-copa-5d5c4-default-rtdb.firebaseio.com",
  projectId: "bolao-copa-5d5c4",
  storageBucket: "bolao-copa-5d5c4.firebasestorage.app",
  messagingSenderId: "205906994856",
  appId: "1:205906994856:web:962f356bb3efa6ef56c49d"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = (typeof firebase.auth === 'function') ? firebase.auth() : null;
const ADMIN_PASSWORD = 'leyd1703@';

// ── Dados dos jogos ───────────────────────────────────────────────────────
const ISO = {
  "México":"mx","África do Sul":"za","Coreia do Sul":"kr","Rep. Tcheca":"cz",
  "Canadá":"ca","Bósnia":"ba","Estados Unidos":"us","Paraguai":"py",
  "Austrália":"au","Turquia":"tr","Catar":"qa","Suíça":"ch",
  "Brasil":"br","Marrocos":"ma","Haiti":"ht","Escócia":"gb-sct",
  "Alemanha":"de","Curaçao":"cw","Holanda":"nl","Japão":"jp",
  "Costa do Marfim":"ci","Equador":"ec","Tunísia":"tn","Suécia":"se",
  "Espanha":"es","Cabo Verde":"cv","Bélgica":"be","Egito":"eg",
  "Arábia Saudita":"sa","Uruguai":"uy","Irã":"ir","Nova Zelândia":"nz",
  "Argentina":"ar","Argélia":"dz","França":"fr","Senegal":"sn",
  "Noruega":"no","Iraque":"iq","Áustria":"at","Jordânia":"jo",
  "Portugal":"pt","RD Congo":"cd","Inglaterra":"gb-eng","Croácia":"hr",
  "Gana":"gh","Panamá":"pa","Uzbequistão":"uz","Colômbia":"co"
};
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
})[ch]);
const escapeJsArg = value => escapeHtml(JSON.stringify(String(value ?? '')));
const safeInitial = value => escapeHtml(String(value || '?').trim().charAt(0).toUpperCase() || '?');

const fl = n => ISO[n]
  ? `<img src="https://flagcdn.com/w40/${ISO[n]}.png" style="height:22px;width:auto;border-radius:2px;vertical-align:middle" alt="${escapeHtml(n)}" onerror="this.style.display='none'">`
  : "🏳️";

function randomSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map(b => b.toString(16).padStart(2,'0')).join('');
}
async function sha256(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2,'0')).join('');
}
async function makePasswordFields(password) {
  const passSalt = randomSalt();
  const passHash = await sha256(`${passSalt}:${password}`);
  return {passHash, passSalt};
}
async function verifyPlayerPassword(player, password) {
  if(player.passHash && player.passSalt) {
    return await sha256(`${player.passSalt}:${password}`) === player.passHash;
  }
  return btoa(unescape(encodeURIComponent(password))) === player.pass;
}
async function migrateLegacyPassword(player, password) {
  if(!player.pass || player.passHash) return;
  const fields = await makePasswordFields(password);
  await db.ref(`players/${player.id}`).update({...fields, pass:null});
  Object.assign(player, fields, {pass:null});
}
async function ensureAnonymousAuth() {
  if (!auth) return null;
  if (auth.currentUser) return auth.currentUser;
  const cred = await auth.signInAnonymously();
  return cred.user;
}
async function ensurePlayerOwner(player) {
  const user = await ensureAnonymousAuth();
  if (!user) return null;
  if (player.ownerUid === user.uid) return user;
  try {
    await db.ref(`players/${player.id}/ownerUid`).set(user.uid);
    player.ownerUid = user.uid;
  } catch(e) {
    if((e.code || '').includes('PERMISSION_DENIED')) {
      showToast("Sessão vinculada a outro dispositivo. Peça ao admin para resetar.", "err");
    }
  }
  return user;
}

const BASE_MATCHES = [
  [1,"México","África do Sul","11/06","16:00","A",1],[2,"Coreia do Sul","Rep. Tcheca","11/06","23:00","A",1],
  [3,"Canadá","Bósnia","12/06","16:00","B",1],[4,"Estados Unidos","Paraguai","12/06","22:00","D",1],
  [5,"Austrália","Turquia","13/06","01:00","D",1],[6,"Catar","Suíça","13/06","16:00","B",1],
  [7,"Brasil","Marrocos","13/06","19:00","C",1],[8,"Haiti","Escócia","13/06","22:00","C",1],
  [9,"Alemanha","Curaçao","14/06","14:00","E",1],[10,"Holanda","Japão","14/06","17:00","F",1],
  [11,"Costa do Marfim","Equador","14/06","20:00","E",1],[12,"Suécia","Tunísia","14/06","23:00","F",1],
  [13,"Espanha","Cabo Verde","15/06","13:00","H",1],[14,"Bélgica","Egito","15/06","16:00","G",1],
  [15,"Arábia Saudita","Uruguai","15/06","19:00","H",1],[16,"Irã","Nova Zelândia","15/06","22:00","G",1],
  [17,"Argentina","Argélia","16/06","14:00","J",1],[18,"França","Senegal","16/06","16:00","I",1],
  [19,"Iraque","Noruega","16/06","19:00","I",1],[20,"Áustria","Jordânia","17/06","01:00","J",1],
  [21,"Portugal","RD Congo","17/06","14:00","K",1],[22,"Inglaterra","Croácia","17/06","17:00","L",1],
  [23,"Gana","Panamá","17/06","20:00","L",1],[24,"Uzbequistão","Colômbia","17/06","23:00","K",1],
  [25,"Rep. Tcheca","África do Sul","18/06","13:00","A",2],[26,"Suíça","Bósnia","18/06","16:00","B",2],
  [27,"Canadá","Catar","18/06","19:00","B",2],[28,"México","Coreia do Sul","18/06","22:00","A",2],
  [29,"Turquia","Paraguai","19/06","01:00","D",2],[30,"Estados Unidos","Austrália","19/06","16:00","D",2],
  [31,"Escócia","Marrocos","19/06","19:00","C",2],[32,"Brasil","Haiti","19/06","22:00","C",2],
  [33,"Holanda","Suécia","20/06","14:00","F",2],[34,"Alemanha","Costa do Marfim","20/06","17:00","E",2],
  [35,"Equador","Curaçao","20/06","21:00","E",2],[36,"Tunísia","Japão","21/06","01:00","F",2],
  [37,"Espanha","Arábia Saudita","21/06","13:00","H",2],[38,"Bélgica","Irã","21/06","16:00","G",2],
  [39,"Uruguai","Cabo Verde","21/06","19:00","H",2],[40,"Nova Zelândia","Egito","21/06","22:00","G",2],
  [41,"Argentina","Áustria","22/06","14:00","J",2],[42,"França","Iraque","22/06","18:00","I",2],
  [43,"Noruega","Senegal","22/06","21:00","I",2],[44,"Jordânia","Argélia","23/06","00:00","J",2],
  [45,"Inglaterra","Gana","23/06","14:00","L",2],[46,"Portugal","Uzbequistão","23/06","17:00","K",2],
  [47,"Panamá","Croácia","23/06","20:00","L",2],[48,"Colômbia","RD Congo","23/06","23:00","K",2],
  [49,"Suíça","Canadá","24/06","16:00","B",3],[50,"Bósnia","Catar","24/06","16:00","B",3],
  [51,"Escócia","Brasil","24/06","19:00","C",3],[52,"Marrocos","Haiti","24/06","19:00","C",3],
  [53,"Rep. Tcheca","México","24/06","22:00","A",3],[54,"África do Sul","Coreia do Sul","24/06","22:00","A",3],
  [55,"Equador","Alemanha","25/06","17:00","E",3],[56,"Curaçao","Costa do Marfim","25/06","17:00","E",3],
  [57,"Japão","Suécia","25/06","20:00","F",3],[58,"Tunísia","Holanda","25/06","20:00","F",3],
  [59,"Turquia","Estados Unidos","25/06","23:00","D",3],[60,"Paraguai","Austrália","25/06","23:00","D",3],
  [61,"Noruega","França","26/06","16:00","I",3],[62,"Senegal","Iraque","26/06","16:00","I",3],
  [63,"Cabo Verde","Arábia Saudita","26/06","21:00","H",3],[64,"Uruguai","Espanha","26/06","21:00","H",3],
  [65,"Egito","Irã","27/06","00:00","G",3],[66,"Nova Zelândia","Bélgica","27/06","00:00","G",3],
  [67,"Panamá","Inglaterra","27/06","18:00","L",3],[68,"Croácia","Gana","27/06","18:00","L",3],
  [69,"Colômbia","Portugal","27/06","20:30","K",3],[70,"RD Congo","Uzbequistão","27/06","20:30","K",3],
  [71,"Argélia","Áustria","27/06","23:00","J",3],[72,"Jordânia","Argentina","27/06","23:00","J",3],
].map(([id,home,away,date,time,group,rodada])=>({id,home,away,date,time,group,rodada,homeFlag:fl(home),awayFlag:fl(away),realHome:null,realAway:null}));

const KNOCKOUT_PHASES = [
  {code:"R32",label:"Fase 32"},{code:"R16",label:"Oitavas"},
  {code:"QF",label:"Quartas"},{code:"SF",label:"Semifinal"},
  {code:"3P",label:"3º Lugar"},{code:"FIN",label:"🏆 Final"},
];
const BASE_KNOCKOUT = [
  {id:101,phase:"R32",date:"28/06",time:"16:00",defaultHome:"África do Sul",defaultAway:"Canadá"},
  {id:102,phase:"R32",date:"29/06",time:"14:00",defaultHome:"Brasil",defaultAway:"Japão"},
  {id:103,phase:"R32",date:"29/06",time:"17:30",defaultHome:"Alemanha",defaultAway:"Paraguai"},
  {id:104,phase:"R32",date:"29/06",time:"21:00",defaultHome:"Holanda",defaultAway:"Marrocos"},
  {id:105,phase:"R32",date:"30/06",time:"13:00",defaultHome:"Costa do Marfim",defaultAway:"Noruega"},
  {id:106,phase:"R32",date:"30/06",time:"18:00",defaultHome:"França",defaultAway:"Suécia"},
  {id:107,phase:"R32",date:"30/06",time:"21:00",defaultHome:"México",defaultAway:"Equador"},
  {id:108,phase:"R32",date:"01/07",time:"13:00",defaultHome:"Inglaterra",defaultAway:"RD Congo"},
  {id:109,phase:"R32",date:"01/07",time:"17:00",defaultHome:"Bélgica",defaultAway:"Senegal"},
  {id:110,phase:"R32",date:"01/07",time:"21:00",defaultHome:"Estados Unidos",defaultAway:"Bósnia"},
  {id:111,phase:"R32",date:"02/07",time:"16:00",defaultHome:"Espanha",defaultAway:"Áustria"},
  {id:112,phase:"R32",date:"02/07",time:"20:00",defaultHome:"Portugal",defaultAway:"Croácia"},
  {id:113,phase:"R32",date:"03/07",time:"00:00",defaultHome:"Suíça",defaultAway:"Argélia"},
  {id:114,phase:"R32",date:"03/07",time:"14:00",defaultHome:"Austrália",defaultAway:"Egito"},
  {id:115,phase:"R32",date:"03/07",time:"19:00",defaultHome:"Argentina",defaultAway:"Cabo Verde"},
  {id:116,phase:"R32",date:"03/07",time:"21:30",defaultHome:"Colômbia",defaultAway:"Gana"},
  {id:117,phase:"R16",date:"04/07",time:"15:00",defaultHome:"Canadá",defaultAway:"Marrocos"},
  {id:118,phase:"R16",date:"04/07",time:"19:00",defaultHome:"Paraguai",defaultAway:"França"},
  {id:119,phase:"R16",date:"05/07",time:"18:00",defaultHome:"Brasil",defaultAway:"Noruega"},
  {id:120,phase:"R16",date:"05/07",time:"22:00",defaultHome:"México",defaultAway:"Inglaterra"},
  {id:121,phase:"R16",date:"06/07",time:"17:00",defaultHome:"Espanha",defaultAway:"Portugal"},
  {id:122,phase:"R16",date:"06/07",time:"22:00",defaultHome:"Bélgica",defaultAway:"Estados Unidos"},
  {id:123,phase:"R16",date:"07/07",time:"14:00",defaultHome:"Egito",defaultAway:"Argentina"},
  {id:124,phase:"R16",date:"07/07",time:"18:00",defaultHome:"Suíça",defaultAway:"Colômbia"},
  {id:125,phase:"QF",date:"11/07",time:"16:00"},{id:126,phase:"QF",date:"11/07",time:"22:00"},
  {id:127,phase:"QF",date:"12/07",time:"16:00"},{id:128,phase:"QF",date:"12/07",time:"22:00"},
  {id:129,phase:"SF",date:"15/07",time:"22:00"},{id:130,phase:"SF",date:"16/07",time:"22:00"},
  {id:131,phase:"3P",date:"18/07",time:"14:00"},
  {id:132,phase:"FIN",date:"19/07",time:"17:00"},
].map(m=>({...m,home:"?",away:"?",homeFlag:"🏳️",awayFlag:"🏳️",realHome:null,realAway:null}));

const ICONS = ['🦁','🐯','🦊','🐺','🐻','🐼','🦋','🦅','🦈','🐬','🐉','🦄','🦓','🐘','🦀','🐸','🐧','🦉',
               '🔥','⚡','💎','👑','🌟','🚀','💀','🎭','🎸','🎮','😎','🤩','💪','🏆','⚽','🥊','🎯','🏄'];
let selectedIcon = '';
const av = p => p.icon
  ? `<span class="avatar" style="font-size:20px;background:#0d1525">${escapeHtml(p.icon)}</span>`
  : `<span class="avatar">${safeInitial(p.name)}</span>`;

// ── Estado global ─────────────────────────────────────────────────────────
let players = [];
let matches = JSON.parse(JSON.stringify(BASE_MATCHES));
let knockoutMatches = JSON.parse(JSON.stringify(BASE_KNOCKOUT));
let guesses = {};
let currentPlayer = null;
let adminUnlocked = false;
let gameFilter = "Todos";
let adminFilter = "Todos";
let adminTab = "participantes";
let homePlayerSearch = "";
let myPlayerId = localStorage.getItem('bcp_me');
let pendingPlayerId = null;
let editingPlayerId = null;
let rawKnockoutTeams = {};
let rawResults = {};
let penalties = {};
let championGuesses = {};
let realChampion = null;
let rankingView = "players";
let firstResultsLoad = true;
const notifiedResults = new Set(JSON.parse(localStorage.getItem('bcp_notified')||'[]'));
let countdownTimer = null;
let champPickerMode = "player";
let autoResultsStatus = localStorage.getItem('bcp_auto_results_status') || 'Aguardando sincronizacao';
let autoResultsRunning = false;
let prevRankingOrder = JSON.parse(localStorage.getItem('bcp_rank_order') || '[]');
let compareP1 = null;
let compareP2 = null;
let authUser = null;
if(auth) auth.onAuthStateChanged(user => { authUser = user; });
const savedGuessFeedback = {};
const savedAdminResultFeedback = {};
const guessSaveTimers = {};

// ── Toast ─────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type="ok") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.style.background = type==="ok" ? "#00e676" : "#e53935";
  t.style.color = type==="ok" ? "#000" : "#fff";
  t.style.opacity = "1";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.style.opacity="0", 2500);
}

// ── Nav ───────────────────────────────────────────────────────────────────
function goTo(screen) {
  document.querySelectorAll("#app>div").forEach(d=>d.classList.remove("active"));
  document.getElementById("screen-"+screen).classList.add("active");
  window.scrollTo(0,0);
  ({home:renderHome, game:renderGame, ranking:renderRanking, admin:renderAdmin})[screen]();
}
window.goTo = goTo;

// ── Pontuação ─────────────────────────────────────────────────────────────
function calcPts(g, m) {
  if(m.realHome===null||m.realAway===null) return 0;
  if(g.home===m.realHome&&g.away===m.realAway) return 10;
  const gw=g.home>g.away?"h":g.home<g.away?"a":"d";
  const rw=m.realHome>m.realAway?"h":m.realHome<m.realAway?"a":"d";
  if(gw===rw) return rw==="d"?7:5;
  return 0;
}
function matchTime(m) {
  const [day, month] = m.date.split('/').map(Number);
  const [hour, min] = m.time.split(':').map(Number);
  return Date.UTC(2026, month - 1, day, hour + 3, min);
}
function isLocked(m) { return Date.now() >= matchTime(m); }
function canEditGuess(m, isMyScreen) {
  return isMyScreen && m && m.home !== "?" && m.away !== "?" && Date.now() < matchTime(m);
}
// Mata-mata pode ir a prorrogação + pênaltis, então damos uma janela maior antes de considerar "Finalizado".
function matchDurationMs(m) { return m.phase ? 12000000 : 9000000; }
function isLive(m) { const t = matchTime(m); const n = Date.now(); return n >= t && n < t + matchDurationMs(m); }
function isFinished(m) { return Date.now() >= matchTime(m) + matchDurationMs(m); }
function matchStatusBadge(m) {
  if(m.realHome !== null && m.realAway !== null) return '<span class="status-badge status-done">Resultado inserido</span>';
  if(isLive(m)) return '<span class="status-badge status-live">Ao vivo</span>';
  if(isFinished(m)) return '<span class="status-badge status-ended">Finalizado</span>';
  if(isLocked(m)) return '<span class="status-badge status-locked">Bloqueado</span>';
  return '<span class="status-badge status-wait">Aguardando</span>';
}
function isChampionLocked() {
  const firstR16 = BASE_KNOCKOUT.filter(m=>m.phase==='R16').sort((a,b)=>matchTime(a)-matchTime(b))[0];
  return firstR16 ? Date.now() >= matchTime(firstR16) : false;
}
function champPts(pid) { return (realChampion && championGuesses[pid] === realChampion) ? 30 : 0; }
function playerStats(pid) {
  const pg = guesses[pid] || {};
  const all = [...matches, ...knockoutMatches].filter(m => m.realHome !== null && pg[m.id]);
  return {
    total: all.length,
    exact:  all.filter(m => calcPts(pg[m.id],m)===10).length,
    draw:   all.filter(m => calcPts(pg[m.id],m)===7).length,
    winner: all.filter(m => calcPts(pg[m.id],m)===5).length,
    wrong:  all.filter(m => calcPts(pg[m.id],m)===0).length,
  };
}
function rebuildKnockout() {
  knockoutMatches = BASE_KNOCKOUT.map(m => {
    const home = rawKnockoutTeams[m.id]?.home || m.defaultHome || "?";
    const away = rawKnockoutTeams[m.id]?.away || m.defaultAway || "?";
    return { ...m, home, away,
      homeFlag: home!=="?" ? fl(home) : "🏳️",
      awayFlag: away!=="?" ? fl(away) : "🏳️",
      realHome: rawResults[m.id]?.home ?? null,
      realAway: rawResults[m.id]?.away ?? null,
    };
  });
}
function playerTotalPts(pid) {
  const pg = guesses[pid] || {};
  const raw = [...matches,...knockoutMatches].reduce((a,m)=>{ const g=pg[m.id]; return g?a+calcPts(g,m):a; },0) + champPts(pid);
  return raw - (penalties[pid] || 0);
}
function playerFilled(pid) {
  const pg = guesses[pid] || {};
  return [...matches,...knockoutMatches].filter(m=>pg[m.id]).length;
}

// Resultados automaticos: roda no navegador e nunca sobrescreve resultado existente.
const AUTO_RESULTS_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
const AUTO_RESULTS_INTERVAL = 30 * 60 * 1000;
const TEAM_ALIASES = {
  "México":["mexico"], "África do Sul":["south africa"], "Coreia do Sul":["south korea","korea republic"],
  "Rep. Tcheca":["czech republic","czechia"], "Canadá":["canada"], "Bósnia":["bosnia","bosnia and herzegovina","bosnia & herzegovina","bosnia-herzegovina"],
  "Estados Unidos":["united states","usa"], "Paraguai":["paraguay"], "Austrália":["australia"],
  "Turquia":["turkiye","turkey"], "Catar":["qatar"], "Suíça":["switzerland"], "Brasil":["brazil"],
  "Marrocos":["morocco"], "Haiti":["haiti"], "Escócia":["scotland"], "Alemanha":["germany"],
  "Curaçao":["curacao","curaçao"], "Holanda":["netherlands","holland"], "Japão":["japan"],
  "Costa do Marfim":["ivory coast","cote d ivoire","côte d ivoire"], "Equador":["ecuador"],
  "Tunísia":["tunisia"], "Suécia":["sweden"], "Espanha":["spain"], "Cabo Verde":["cape verde"],
  "Bélgica":["belgium"], "Egito":["egypt"], "Arábia Saudita":["saudi arabia"], "Uruguai":["uruguay"],
  "Irã":["iran"], "Nova Zelândia":["new zealand"], "Argentina":["argentina"], "Argélia":["algeria"],
  "França":["france"], "Senegal":["senegal"], "Noruega":["norway"], "Iraque":["iraq"],
  "Áustria":["austria"], "Jordânia":["jordan"], "Portugal":["portugal"],
  "RD Congo":["dr congo","congo dr","democratic republic of congo"], "Inglaterra":["england"],
  "Croácia":["croatia"], "Gana":["ghana"], "Panamá":["panama"], "Uzbequistão":["uzbekistan"],
  "Colômbia":["colombia"]
};
function normalizeName(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}
function teamNames(name) { return [name, ...(TEAM_ALIASES[name] || [])].map(normalizeName).filter(Boolean); }
function sameTeam(appName, apiName) {
  const api = normalizeName(apiName);
  return teamNames(appName).some(n => api === n || api.includes(n) || n.includes(api));
}
function readPath(obj, paths) {
  for(const path of paths) {
    const value = path.split('.').reduce((acc, key) => acc && acc[key], obj);
    if(value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}
function normalizeApiMatch(item) {
  const comp = item.competitions?.[0];
  if(comp?.competitors?.length) {
    const homeTeam = comp.competitors.find(c => c.homeAway === 'home');
    const awayTeam = comp.competitors.find(c => c.homeAway === 'away');
    return {
      home: homeTeam?.team?.displayName || homeTeam?.team?.name,
      away: awayTeam?.team?.displayName || awayTeam?.team?.name,
      homeScore: Number(homeTeam?.score),
      awayScore: Number(awayTeam?.score),
      status: comp.status?.type?.completed ? 'completed' : normalizeName(comp.status?.type?.state || comp.status?.type?.name || '')
    };
  }
  const home = readPath(item, ['home.name','home_team.name','homeTeam.name','teams.home.name','team_home','home','homeTeam','localteam.name']);
  const away = readPath(item, ['away.name','away_team.name','awayTeam.name','teams.away.name','team_away','away','awayTeam','visitorteam.name']);
  const homeScore = readPath(item, ['score.home','scores.home','home_score','homeScore','goals.home','result.home','scores.fulltime.home','ft_score.home']);
  const awayScore = readPath(item, ['score.away','scores.away','away_score','awayScore','goals.away','result.away','scores.fulltime.away','ft_score.away']);
  const status = normalizeName(readPath(item, ['status.long','status.short','status','state','match_status']) || '');
  return {home, away, homeScore:Number(homeScore), awayScore:Number(awayScore), status};
}
function isFinalStatus(status) {
  return !status || ['ft','full time','finished','final','ended','complete','completed'].some(s => status.includes(s));
}
function flattenApiMatches(data) {
  if(Array.isArray(data?.events)) return data.events;
  if(Array.isArray(data)) return data;
  return Object.values(data || {}).flatMap(v => Array.isArray(v) ? v : (v && typeof v === 'object' ? [v] : []));
}
function matchDateKey(match) {
  const [day, month] = match.date.split('/').map(Number);
  return `2026${String(month).padStart(2,'0')}${String(day).padStart(2,'0')}`;
}
function findAutoResultFor(match, apiMatches) {
  for (const item of apiMatches) {
    const r = normalizeApiMatch(item);
    if(!r.home || !r.away || !Number.isInteger(r.homeScore) || !Number.isInteger(r.awayScore)) continue;
    if(!isFinalStatus(r.status)) continue;
    if(sameTeam(match.home, r.home) && sameTeam(match.away, r.away)) return {item, swapped:false};
    if(sameTeam(match.home, r.away) && sameTeam(match.away, r.home)) return {item, swapped:true};
  }
  return null;
}
function setAutoResultsStatus(text) {
  autoResultsStatus = text;
  localStorage.setItem('bcp_auto_results_status', text);
  if(adminUnlocked && document.getElementById("screen-admin").classList.contains("active")) renderAdmin();
}
async function runAutoResultSync(force=false) {
  if(autoResultsRunning) return;
  if(!adminUnlocked) {
    setAutoResultsStatus('Aguardando admin autenticado para gravar resultados');
    return;
  }
  const now = Date.now();
  const last = +(localStorage.getItem('bcp_auto_results_last') || 0);
  if(!force && now - last < AUTO_RESULTS_INTERVAL) return;
  const pending = [...matches, ...knockoutMatches].filter(m =>
    m.home !== "?" && m.away !== "?" && m.realHome === null && m.realAway === null && isFinished(m)
  );
  if(!pending.length) {
    localStorage.setItem('bcp_auto_results_last', String(now));
    setAutoResultsStatus('Nenhum jogo encerrado pendente');
    return;
  }
  autoResultsRunning = true;
  setAutoResultsStatus('Buscando resultados automaticamente...');
  try {
    const dates = [...new Set(pending.map(matchDateKey))];
    const apiMatches = [];
    for(const date of dates) {
      const resp = await fetch(`${AUTO_RESULTS_URL}?dates=${date}`, {cache:'no-store'});
      if(!resp.ok) throw new Error(`HTTP ${resp.status}`);
      apiMatches.push(...flattenApiMatches(await resp.json()));
    }
    const updates = {};
    pending.forEach(m => {
      const found = findAutoResultFor(m, apiMatches);
      if(!found) return;
      const r = normalizeApiMatch(found.item);
      updates[`results/${m.id}/home`] = found.swapped ? r.awayScore : r.homeScore;
      updates[`results/${m.id}/away`] = found.swapped ? r.homeScore : r.awayScore;
    });
    localStorage.setItem('bcp_auto_results_last', String(now));
    if(Object.keys(updates).length) {
      await db.ref().update(updates);
      setAutoResultsStatus(`${Object.keys(updates).length / 2} resultado(s) inserido(s) automaticamente`);
      showToast("Resultados automáticos atualizados!");
    } else {
      setAutoResultsStatus('Sem placares finais encontrados na API');
    }
  } catch (err) {
    setAutoResultsStatus('Falha ao buscar resultados automaticos');
  } finally {
    autoResultsRunning = false;
  }
}
window.runAutoResultSync = runAutoResultSync;

// ── Firebase listeners ────────────────────────────────────────────────────
function rerender(screens) {
  const focused = document.activeElement;
  screens.forEach(s => {
    const el = document.getElementById("screen-"+s);
    if(!el.classList.contains("active")) return;
    if(focused && el.contains(focused) && (focused.tagName==="INPUT"||focused.tagName==="TEXTAREA")) return;
    ({home:renderHome,game:renderGame,ranking:renderRanking,admin:renderAdmin})[s]();
  });
}
function initFirebase() {
  db.ref("players").on("value", snap => {
    players = snap.val() ? Object.values(snap.val()) : [];
    rerender(["home","ranking"]);
  });
  db.ref("guesses").on("value", snap => {
    guesses = snap.val() || {};
    rerender(["home","ranking"]);
  });
  db.ref("results").on("value", snap => {
    const incoming = snap.val() || {};
    if(!firstResultsLoad) {
      Object.entries(incoming).forEach(([mid, res]) => {
        if(res.home===undefined || res.away===undefined) return;
        const old = [...matches,...knockoutMatches].find(m=>m.id===+mid);
        if(old && old.realHome===null) maybeNotify(+mid, res);
      });
    } else { firstResultsLoad = false; }
    rawResults = incoming;
    matches = BASE_MATCHES.map(m => ({
      ...m,
      realHome: rawResults[m.id]?.home ?? null,
      realAway: rawResults[m.id]?.away ?? null,
    }));
    rebuildKnockout();
    rerender(["home","game","ranking","admin"]);
    setTimeout(() => runAutoResultSync(false), 500);
  });
  db.ref("knockout_teams").on("value", snap => {
    rawKnockoutTeams = snap.val() || {};
    rebuildKnockout();
    rerender(["game","admin"]);
  });
  db.ref("champion_guesses").on("value", snap => {
    championGuesses = snap.val() || {};
    rerender(["game","ranking"]);
  });
  db.ref("champion").on("value", snap => {
    realChampion = snap.val() || null;
    rerender(["game","ranking","admin"]);
  });
  db.ref("penalties").on("value", snap => {
    penalties = snap.val() || {};
    rerender(["home","game","ranking"]);
  });
}

// ── HOME ──────────────────────────────────────────────────────────────────
function renderHome() {
  const played = matches.filter(m=>m.realHome!==null).length;
  let playersHTML = "";
  if(players.length > 0) {
    const filteredPlayers = players
      .filter(p => !homePlayerSearch || normalizeName(p.name).includes(normalizeName(homePlayerSearch)))
      .sort((a, b) => playerTotalPts(b.id) - playerTotalPts(a.id));
    playersHTML = `<div class="card"><div class="label"><span class="live-dot"></span>PARTICIPANTES AO VIVO</div>
      <input class="inp" value="${escapeHtml(homePlayerSearch)}" placeholder="Buscar participante..." oninput="setHomePlayerSearch(this.value)" style="margin-bottom:10px"/>`;
    filteredPlayers.forEach(p => {
      const pts = playerTotalPts(p.id), filled = playerFilled(p.id);
      playersHTML += `<button class="player-btn" onclick="selectPlayer(${escapeJsArg(p.id)})">
        ${av(p)}
        <span style="flex:1;text-align:left">
          <span style="font-weight:700">${escapeHtml(p.name)}</span>
          <span style="display:block;font-size:11px;color:#8896a8;margin-top:1px">${filled}/72 palpites</span>
        </span>
        <span style="color:#FFD700;font-weight:900;font-size:18px">${pts}<span style="font-size:11px;font-weight:400;color:#666"> pts</span></span>
        <span style="color:#333;font-size:20px;margin-left:8px">›</span>
      </button>`;
    });
    if(filteredPlayers.length === 0) playersHTML += '<p style="color:#6b7a8c;font-size:12px;text-align:center;padding:12px">Nenhum participante encontrado</p>';
    playersHTML += `</div>`;
  }
  document.getElementById("screen-home").innerHTML = `
    <div class="screen">
      <div style="text-align:center;padding:36px 0 24px">
        <div style="font-size:64px;margin-bottom:8px">🏆</div>
        <div style="font-family:'Bebas Neue',cursive;font-size:52px;line-height:1;letter-spacing:2px">BOLÃO<br><span style="color:#FFD700">COPA 2026</span></div>
        <p style="color:#8896a8;margin-top:10px;font-size:13px">${played}/72 jogos apurados</p>
        <div id="countdown-home" style="font-size:12px;color:#FFD700;font-weight:700;margin-top:6px;min-height:18px"></div>
      </div>
      <div class="card">
        <div class="label">ENTRAR NO BOLÃO</div>
        <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px">
          ${ICONS.map(ic=>`<button data-icon="${ic}" onclick="pickIcon('${ic}')" style="width:34px;height:34px;font-size:18px;background:${selectedIcon===ic?'#2a2200':'#0d1525'};border:1px solid ${selectedIcon===ic?'#FFD700':'#1a2540'};border-radius:8px;cursor:pointer;transition:all .15s">${ic}</button>`).join('')}
        </div>
        <input class="inp" id="new-name" placeholder="Seu nome..." style="margin-bottom:8px" onkeydown="if(event.key==='Enter')document.getElementById('new-pass').focus()"/>
        <div style="display:flex;gap:8px">
          <input class="inp" id="new-pass" type="password" placeholder="Crie uma senha..." onkeydown="if(event.key==='Enter')addPlayer()"/>
          <button class="btn btn-green" onclick="addPlayer()">+</button>
        </div>
      </div>
      ${playersHTML}
      <div style="display:flex;gap:10px;margin-top:4px">
        <button class="btn btn-outline" onclick="goTo('ranking')">🏅 Ranking</button>
        <button class="btn btn-outline" onclick="openRules()">📋 Regras</button>
        <button class="btn btn-outline" onclick="goTo('admin')">⚙️ Admin</button>
        ${('Notification' in window) ? '<button class="btn btn-outline" onclick="requestNotifPerm()" title="Ativar alertas de resultados" style="flex:0;padding:11px 12px">'+(Notification.permission==='granted'?'🔔':'🔕')+'</button>' : ''}
      </div>
    </div>`;
  startCountdown();
}

function startCountdown() {
  if(countdownTimer) clearInterval(countdownTimer);
  const update = () => {
    const el = document.getElementById('countdown-home');
    if(!el) { clearInterval(countdownTimer); countdownTimer = null; return; }
    const next = [...matches,...knockoutMatches]
      .filter(m => m.home!=="?" && m.away!=="?" && !isLocked(m))
      .sort((a,b) => matchTime(a) - matchTime(b))[0];
    if(!next) { el.textContent = ''; return; }
    const diff = matchTime(next) - Date.now();
    if(diff <= 0) { el.textContent = `⚽ ${next.home} × ${next.away} — em breve!`; return; }
    const h = Math.floor(diff/3600000);
    const mn = Math.floor((diff%3600000)/60000);
    const s = Math.floor((diff%60000)/1000);
    el.textContent = `⏱️ Próximo: ${next.home} × ${next.away} em ${h>0?h+'h ':''}${mn}min ${s}s`;
  };
  update();
  countdownTimer = setInterval(update, 1000);
}

window.pickIcon = function(ic) {
  selectedIcon = selectedIcon === ic ? '' : ic;
  document.querySelectorAll('[data-icon]').forEach(btn => {
    const sel = btn.dataset.icon === selectedIcon;
    btn.style.background = sel ? '#2a2200' : '#0d1525';
    btn.style.borderColor = sel ? '#FFD700' : '#1a2540';
  });
};
window.setHomePlayerSearch = function(value) {
  homePlayerSearch = value;
  renderHome();
  setTimeout(() => {
    const input = document.querySelector('#screen-home input[placeholder="Buscar participante..."]');
    if(input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }, 0);
};

window.addPlayer = async function() {
  const inp = document.getElementById("new-name");
  const passInp = document.getElementById("new-pass");
  const name = inp.value.trim();
  const pass = passInp.value.trim();
  if(!name) return;
  if(!pass) { showToast("Crie uma senha!","err"); return; }
  if(players.find(p=>p.name.toLowerCase()===name.toLowerCase())) { showToast("Nome já existe!","err"); return; }
  let ownerUid;
  try { ownerUid = (await ensureAnonymousAuth()).uid; }
  catch(e) { showToast("Erro de autenticação. Tente novamente.","err"); return; }
  const id = "p_"+Date.now();
  const passFields = await makePasswordFields(pass);
  await db.ref(`players/${id}`).set({id, name, ...passFields, icon: selectedIcon, ownerUid});
  myPlayerId = id; localStorage.setItem('bcp_me', id);
  selectedIcon = '';
  inp.value = ""; passInp.value = "";
  showToast(`${name} entrou no bolão! 🎉`);
};

window.selectPlayer = function(id) {
  const player = players.find(p=>p.id===id);
  if(myPlayerId === id) { currentPlayer = player; gameFilter="Todos"; goTo("game"); ensurePlayerOwner(player).catch(()=>{}); return; }
  if(!player.pass && !player.passHash) {
    if(!myPlayerId) { myPlayerId = id; localStorage.setItem('bcp_me', id); }
    currentPlayer = player; gameFilter="Todos"; goTo("game"); return;
  }
  pendingPlayerId = id;
  document.getElementById("modal-player-name").textContent = player.name;
  document.getElementById("modal-pass-inp").value = "";
  document.getElementById("modal-pass").style.display = "flex";
  setTimeout(()=>document.getElementById("modal-pass-inp").focus(), 100);
};

// ── GAME ──────────────────────────────────────────────────────────────────
function renderGame() {
  if(!currentPlayer) return;
  const isMyScreen = !!myPlayerId && currentPlayer.id === myPlayerId;
  const saved = guesses[currentPlayer.id] || {};
  const pts = playerTotalPts(currentPlayer.id);

  // ── Filtros ──
  const isKO = KNOCKOUT_PHASES.some(p=>p.code===gameFilter);
  const groups = Array.from(new Set(matches.map(m=>m.group))).sort();
  const allFilters = [
    {code:"Todos",label:"Todos"},{code:"Sem palpite",label:"Sem palpite"},
    ...groups.map(g=>({code:g,label:"G"+g})),
    ...KNOCKOUT_PHASES.map(p=>({code:p.code,label:p.label})),
  ];
  const groupBtns = allFilters.map(f=>
    `<button class="group-btn${gameFilter===f.code?" active":""}" onclick="setGameFilter(${escapeJsArg(f.code)})">${escapeHtml(f.label)}</button>`
  ).join("");

  let visible;
  if(gameFilter==="Todos") {
    const withResult = [...matches,...knockoutMatches].filter(m=>m.realHome!==null).sort((a,b)=>matchTime(b)-matchTime(a));
    const withoutResult = [...matches,...knockoutMatches].filter(m=>m.realHome===null&&(m.home!=="?"&&m.away!=="?")).sort((a,b)=>matchTime(a)-matchTime(b));
    visible = [...withResult,...withoutResult];
  } else if(gameFilter==="Sem palpite") {
    const gMiss = matches.filter(m=>!saved[m.id]&&!isLocked(m));
    const kMiss = knockoutMatches.filter(m=>m.home!=="?"&&m.away!=="?"&&!saved[m.id]&&!isLocked(m));
    visible = [...gMiss,...kMiss];
  } else if(isKO) visible = knockoutMatches.filter(m=>m.phase===gameFilter);
  else visible = matches.filter(m=>m.group===gameFilter);

  // ── Palpite do campeão ──
  const myChamp = championGuesses[currentPlayer.id];
  const champLocked = isChampionLocked();
  let champHTML = "";
  if(isMyScreen || myChamp) {
    let champContent;
    if(champLocked) {
      const cp = champPts(currentPlayer.id);
      const result = realChampion
        ? `<span style="color:${cp?'#00e676':'#ff5252'};font-weight:900;margin-left:auto">${cp?'🎯 +30pts':'❌ 0pts'}</span>`
        : (realChampion===null?'':'');
      champContent = `<div style="display:flex;align-items:center;gap:10px">
        ${myChamp?`${fl(myChamp)}<span style="font-weight:700">${escapeHtml(myChamp)}</span>`:'<span style="color:#8896a8">Sem palpite</span>'}
        <span class="locked-badge" style="margin-left:4px">🔒 ENCERRADO</span>
        ${realChampion?`<span style="font-size:12px;color:#8896a8;margin-left:4px">Real: <b style="color:#fff">${escapeHtml(realChampion)}</b></span>`:''}
        ${result}
      </div>`;
    } else if(isMyScreen) {
      champContent = `<button onclick="openChampPicker()" style="width:100%;background:#0d1525;border:1px solid ${myChamp?'#FFD700':'#1a2540'};border-radius:10px;padding:12px 14px;color:#fff;text-align:left;display:flex;align-items:center;gap:10px;cursor:pointer">
        ${myChamp?`${fl(myChamp)}<span style="font-weight:700;flex:1">${escapeHtml(myChamp)}</span>`:`<span style="color:#8896a8;flex:1">Selecione o campeão...</span>`}
        <span style="color:#8896a8;font-size:18px">›</span>
      </button>`;
    } else {
      champContent = myChamp
        ? `<div style="display:flex;align-items:center;gap:8px">${fl(myChamp)}<span style="font-weight:700">${escapeHtml(myChamp)}</span><span class="locked-badge">🔒 aguardando resultado</span></div>`
        : '<span style="color:#8896a8;font-size:13px">Sem palpite</span>';
    }
    champHTML = `<div class="card">
      <div class="label">🏆 PALPITE DO CAMPEÃO <span style="font-size:10px;font-weight:400;color:#8896a8">• +30 pts se acertar</span></div>
      ${champContent}
    </div>`;
  }

  // ── Estatísticas ──
  const st = playerStats(currentPlayer.id);
  let statsHTML = "";
  if(st.total > 0) {
    const maxPts = st.total * 10;
    const pct = Math.round(pts / maxPts * 100);
    statsHTML = `<div class="card">
      <div class="label">📊 ESTATÍSTICAS</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
        <div style="background:#0d1525;border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:24px;font-weight:900;color:#FFD700">${st.exact}</div>
          <div style="font-size:10px;color:#8896a8;margin-top:2px">🎯 Placar exato</div>
        </div>
        <div style="background:#0d1525;border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:24px;font-weight:900;color:#69f0ae">${st.draw}</div>
          <div style="font-size:10px;color:#8896a8;margin-top:2px">✅ Empate certo</div>
        </div>
        <div style="background:#0d1525;border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:24px;font-weight:900;color:#b2ff59">${st.winner}</div>
          <div style="font-size:10px;color:#8896a8;margin-top:2px">✅ Vencedor certo</div>
        </div>
        <div style="background:#0d1525;border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:24px;font-weight:900;color:#ff5252">${st.wrong}</div>
          <div style="font-size:10px;color:#8896a8;margin-top:2px">❌ Errou</div>
        </div>
      </div>
      <div style="text-align:center;font-size:12px;color:#8896a8">${st.total} jogo(s) apurado(s) • Aproveitamento: <b style="color:#FFD700">${pct}%</b></div>
      ${(penalties[currentPlayer.id]||0)>0?`<div style="text-align:center;font-size:12px;color:#ff5252;margin-top:6px;font-weight:700">⚠️ Punição por trapaça: -${penalties[currentPlayer.id]}pts</div>`:''}
    </div>`;
  }

  // ── Cards de jogos ──
  const COLORS = {10:"#00e676",7:"#69f0ae",5:"#b2ff59",0:"#ff5252"};
  const LABELS = {10:"🎯 Placar exato! +10pts",7:"✅ Empate certo! +7pts",5:"✅ Vencedor certo +5pts",0:"❌ Errou"};
  let cards = "";
  const koAllPending = isKO && visible.length > 0 && visible.every(m=>m.home==="?"||m.away==="?");
  const latestResultId = gameFilter==="Todos" ? visible.find(m=>m.realHome!==null)?.id : null;
  if(!koAllPending) {
    visible.forEach(m => {
      const g = saved[m.id];
      const locked = isLocked(m);
      const canSee = isMyScreen || locked;
      const teamsSet = !m.phase || (m.home!=="?"&&m.away!=="?");
      const hval = canSee&&g!==undefined ? g.home : "";
      const aval = canSee&&g!==undefined ? g.away : "";
      let resultHTML = "";
      if(m.realHome!==null && canSee) {
        const s = g!==undefined ? calcPts(g,m) : null;
        resultHTML = `<div style="margin-top:7px;font-size:11px;color:#8896a8;text-align:center">
          Placar real: <b style="color:#fff">${m.realHome} × ${m.realAway}</b>
          ${s!==null?`<span style="color:${COLORS[s]};margin-left:6px">${LABELS[s]}</span>`:'<span style="color:#6b7a8c;margin-left:6px">— sem palpite</span>'}
        </div>`;
      }
      let consensusHTML = "";
      if(locked && players.length > 0) {
        const preds = players.map(p => guesses[p.id]?.[m.id]).filter(Boolean);
        if(preds.length > 0) {
          const hv = preds.filter(g2 => g2.home > g2.away).length;
          const dv = preds.filter(g2 => g2.home === g2.away).length;
          const av2 = preds.filter(g2 => g2.home < g2.away).length;
          const t = preds.length;
          consensusHTML = `<div style="display:flex;gap:6px;margin-top:5px;font-size:10px;color:#6b7a8c;flex-wrap:wrap">
            <span>📊</span>
            <span style="color:#b2ff59">${Math.round(hv/t*100)}% casa</span>
            <span>•</span><span style="color:#69f0ae">${Math.round(dv/t*100)}% empate</span>
            <span>•</span><span style="color:#ff9800">${Math.round(av2/t*100)}% fora</span>
            <span>(${t}/${players.length})</span>
          </div>`;
        }
      }
      const bl = (m.realHome!==null&&g!==undefined) ? `border-left:3px solid ${COLORS[calcPts(g,m)]}`
        : (locked||m.realHome!==null) ? "border-left:3px solid #2a2a2a" : "";
      const inputDisabled = !canEditGuess(m, isMyScreen);
      const phaseLabel = m.phase
        ? `${KNOCKOUT_PHASES.find(p=>p.code===m.phase)?.label||m.phase}`
        : `Grupo ${m.group} • R${m.rodada}`;
      const homeD = m.home==="?"?"A definir":escapeHtml(m.home);
      const awayD = m.away==="?"?"A definir":escapeHtml(m.away);
      const isLatest = m.id === latestResultId;
      cards += `<div class="match-card" style="${bl}${locked?";opacity:.75":""}${isLatest?";border:1px solid #FFD70066;box-shadow:0 0 12px #FFD70022":""}">
        ${isLatest?`<div style="font-size:10px;color:#FFD700;font-weight:700;letter-spacing:1px;margin-bottom:6px">🕐 ÚLTIMO RESULTADO</div>`:''}
        <div style="display:flex;justify-content:space-between;font-size:11px;color:#6b7a8c;margin-bottom:8px">
          <span style="color:#FFD700;font-weight:700">${phaseLabel}</span>
          <span style="flex-shrink:0;margin-left:4px">${m.date} ${m.time}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px">
          ${matchStatusBadge(m)}
          <span style="font-size:10px;color:#00e676;min-width:42px;text-align:right">${savedGuessFeedback[m.id] || ''}</span>
        </div>
        <div class="match-teams-row">
          <div class="team-side"><span style="font-size:20px;flex-shrink:0">${m.homeFlag}</span><span class="team-name">${homeD}</span></div>
          <div class="score-box">
            <input class="score-inp" data-mid="${m.id}" data-side="home" value="${hval}" placeholder="${!teamsSet?'—':canSee?'0':'?'}" onfocus="this.select()" oninput="this.value=this.value.replace(/\\D/g,'').slice(0,2); scheduleAutoSaveGuess(${m.id})" inputmode="numeric"${inputDisabled?" disabled":` onblur="autoSaveGuess(${m.id})"`}/>
            <span style="color:#4a5a6e;font-weight:700">×</span>
            <input class="score-inp" data-mid="${m.id}" data-side="away" value="${aval}" placeholder="${!teamsSet?'—':canSee?'0':'?'}" onfocus="this.select()" oninput="this.value=this.value.replace(/\\D/g,'').slice(0,2); scheduleAutoSaveGuess(${m.id})" inputmode="numeric"${inputDisabled?" disabled":` onblur="autoSaveGuess(${m.id})"`}/>
          </div>
          <div class="team-side" style="justify-content:flex-end"><span class="team-name" style="text-align:right">${awayD}</span><span style="font-size:20px;flex-shrink:0">${m.awayFlag}</span></div>
        </div>
        ${resultHTML}
        ${consensusHTML}
      </div>`;
    });
  }

  const noMatches = visible.length === 0;
  document.getElementById("screen-game").innerHTML = `
    <div class="screen">
      <div class="header">
        <button class="back-btn" onclick="goTo('home')">‹ Voltar</button>
        <div>
          <div style="font-weight:800;font-size:18px">${isMyScreen?'':' 👁️ '}${escapeHtml(currentPlayer.name)}</div>
          <div style="color:${isMyScreen?'#FFD700':'#555'};font-size:12px;font-weight:600">${isMyScreen?pts+' pts acumulados':'somente visualização'}</div>
        </div>
        ${isMyScreen?'<button onclick="openChangePass()" style="background:none;border:1px solid #1a2540;border-radius:8px;color:#a8b8c8;padding:6px 10px;font-size:16px;flex-shrink:0" title="Trocar senha">🔑</button>':''}
      </div>
      ${champHTML}
      ${statsHTML}
      <div class="groups-scroll">${groupBtns}</div>
      ${koAllPending?'<div style="text-align:center;color:#6b7a8c;padding:40px 0;font-size:13px">⏳ Times ainda não definidos pelo admin</div>':''}
      ${noMatches&&gameFilter==="Sem palpite"?'<div style="text-align:center;color:#8896a8;padding:40px 0;font-size:13px">✅ Todos os palpites disponíveis já foram preenchidos!</div>':''}
      ${cards}
      ${isMyScreen&&!koAllPending&&!noMatches?`
        <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:8px;font-size:11px;color:#6b7a8c">
          <span>🎯 Placar exato = <b style="color:#aaa">10pts</b></span>
          <span>✅ Empate certo = <b style="color:#aaa">7pts</b></span>
          <span>✅ Vencedor certo = <b style="color:#aaa">5pts</b></span>
        </div>`:(!isMyScreen?`<p style="text-align:center;color:#6b7a8c;font-size:12px;margin-top:20px;padding:0 20px">Palpites de jogos não iniciados estão ocultos</p>`:'')}
    </div>`;
}

window.scheduleAutoSaveGuess = function(mid) {
  clearTimeout(guessSaveTimers[mid]);
  guessSaveTimers[mid] = setTimeout(() => autoSaveGuess(mid), 600);
};

window.autoSaveGuess = async function(mid) {
  if(!currentPlayer) return;
  if(!myPlayerId || currentPlayer.id !== myPlayerId) return;
  const hi = document.querySelector(`.score-inp[data-mid="${mid}"][data-side="home"]`);
  const ai = document.querySelector(`.score-inp[data-mid="${mid}"][data-side="away"]`);
  if(!hi || !ai) return;
  if(hi.value !== "" && ai.value === "") ai.value = "0";
  if(ai.value !== "" && hi.value === "") hi.value = "0";
  if(hi.value === "" || ai.value === "") return;
  const m = [...matches,...knockoutMatches].find(m=>m.id===mid);
  if(!canEditGuess(m, true)) { showToast("Palpite bloqueado: jogo ja iniciou","err"); return; }
  const prev = guesses[currentPlayer.id]?.[mid];
  if(prev !== undefined && prev !== null && prev.home===+hi.value && prev.away===+ai.value) return;
  try { await ensurePlayerOwner(currentPlayer); } catch(e) { showToast("Erro de autenticação","err"); return; }
  try {
    await db.ref(`guesses/${currentPlayer.id}/${mid}`).set({home:+hi.value, away:+ai.value});
    const logEntry = {
      playerId: currentPlayer.id,
      playerName: currentPlayer.name,
      matchId: mid,
      prev: prev !== undefined && prev !== null ? {home: prev.home, away: prev.away} : null,
      next: {home: +hi.value, away: +ai.value},
      uid: authUser?.uid || null,
      ts: firebase.database.ServerValue.TIMESTAMP
    };
    db.ref(`audit_log`).push(logEntry).catch(()=>{});
  } catch (err) {
    showToast("Nao foi possivel salvar. Verifique a conexao e o Firebase.","err");
    return;
  }
  savedGuessFeedback[mid] = "salvo";
  const card = hi.closest('.match-card');
  if(card) {
    card.style.outline = '2px solid #00e676';
    setTimeout(()=>{ card.style.outline=''; }, 1200);
  }
  setTimeout(() => {
    delete savedGuessFeedback[mid];
    const scr = document.getElementById("screen-game");
    const focused = document.activeElement;
    if(scr.classList.contains("active") && !(focused && scr.contains(focused) && (focused.tagName==="INPUT"||focused.tagName==="TEXTAREA"))) renderGame();
  }, 1200);
};

window.setGameFilter = function(g) {
  const y = window.scrollY;
  const bar = document.querySelector('#screen-game .groups-scroll');
  const x = bar ? bar.scrollLeft : 0;
  gameFilter = g;
  renderGame();
  window.scrollTo(0, y);
  const newBar = document.querySelector('#screen-game .groups-scroll');
  if(newBar) newBar.scrollLeft = x;
};

window.saveGuesses = async function() {
  if(!currentPlayer) return;
  const inputs = document.querySelectorAll("#screen-game .score-inp");
  const toSave = {};
  inputs.forEach(inp => {
    const mid = +inp.dataset.mid, side = inp.dataset.side;
    if(!toSave[mid]) toSave[mid] = {};
    toSave[mid][side] = inp.value;
  });
  const allM = [...matches,...knockoutMatches];
  const filled = Object.entries(toSave).filter(([mid,g])=>{
    const m = allM.find(m=>m.id===+mid);
    return m && g.home!=="" && g.away!=="" && !isLocked(m) && m.home!=="?" && m.away!=="?";
  });
  if(!filled.length) { showToast("Preencha pelo menos um palpite disponível!","err"); return; }
  const updates = {};
  filled.forEach(([id,g]) => { updates[`guesses/${currentPlayer.id}/${id}`] = {home:+g.home, away:+g.away}; });
  try {
    await db.ref().update(updates);
  } catch (err) {
    showToast("Nao foi possivel salvar os palpites","err");
    return;
  }
  showToast("Palpites salvos! ✅");
  goTo("home");
};

function buildChampList(query) {
  const selectedChamp = champPickerMode === "admin" ? realChampion : championGuesses[currentPlayer?.id];
  const teams = Object.keys(ISO).sort().filter(t => !query || t.toLowerCase().includes(query.toLowerCase()));
  const el = document.getElementById('champ-list');
  if(!el) return;
  el.innerHTML = teams.length === 0
    ? '<p style="color:#8896a8;text-align:center;padding:20px">Nenhum país encontrado</p>'
    : teams.map(t => `
      <button onclick="${champPickerMode === "admin" ? "pickAdminChamp" : "pickChamp"}(${escapeJsArg(t)})" style="display:flex;align-items:center;gap:10px;width:100%;background:${selectedChamp===t?'#1a1400':'#0d1525'};border:1px solid ${selectedChamp===t?'#FFD700':'#1a2540'};border-radius:8px;padding:10px 12px;color:#fff;margin-bottom:6px;text-align:left;cursor:pointer">
        <span style="flex-shrink:0">${fl(t)}</span>
        <span style="flex:1;font-weight:${selectedChamp===t?'700':'400'}">${escapeHtml(t)}</span>
        ${selectedChamp===t?'<span style="color:#FFD700;font-size:16px">✓</span>':''}
      </button>`).join('');
}
window.openChampPicker = function() {
  champPickerMode = "player";
  buildChampList('');
  document.getElementById('champ-search').value = '';
  document.getElementById('modal-champ').style.display = 'flex';
  setTimeout(() => document.getElementById('champ-search').focus(), 150);
};
window.openAdminChampPicker = function() {
  champPickerMode = "admin";
  buildChampList('');
  document.getElementById('champ-search').value = '';
  document.getElementById('modal-champ').style.display = 'flex';
  setTimeout(() => document.getElementById('champ-search').focus(), 150);
};
window.closeChampPicker = function() {
  document.getElementById('modal-champ').style.display = 'none';
};
window.filterChampList = function(q) { buildChampList(q); };
window.pickChamp = async function(team) {
  if(!currentPlayer) return;
  try { await ensurePlayerOwner(currentPlayer); } catch(e) { showToast("Erro de autenticação","err"); return; }
  await db.ref(`champion_guesses/${currentPlayer.id}`).set(team);
  closeChampPicker();
  showToast(`Palpite do campeão: ${team} 🏆`);
};
window.pickAdminChamp = async function(team) {
  try { await db.ref("champion").set(team); }
  catch (err) { showToast("Nao foi possivel registrar o campeao","err"); return; }
  closeChampPicker();
  showToast("Campeão registrado! 🏆");
};
window.saveChampion = window.pickChamp;

// ── RANKING ───────────────────────────────────────────────────────────────
function renderRanking() {
  const playedTotal = matches.filter(m=>m.realHome!==null).length + knockoutMatches.filter(m=>m.realHome!==null).length;
  const medals = ["🥇","🥈","🥉"];
  const ranking = players.map(p=>({...p,pts:playerTotalPts(p.id)})).sort((a,b)=>b.pts-a.pts);
  const guessableTotal = matches.length + knockoutMatches.filter(m=>m.home!=="?"&&m.away!=="?").length;
  const COLORS = {10:"#00e676",7:"#69f0ae",5:"#b2ff59",0:"#ff5252"};
  const LABELS = {10:"🎯 +10",7:"✅ +7",5:"✅ +5",0:"❌ 0"};

  let content = "";
  if(rankingView === "players") {
    const newOrder = ranking.map(p => p.id);
    content = ranking.length===0
      ? `<div style="text-align:center;color:#6b7a8c;padding:60px">Nenhum participante ainda</div>`
      : ranking.map((p,i)=>{
          const champ = championGuesses[p.id];
          const cp = champPts(p.id);
          const tied = ranking.some((other, idx) => idx !== i && other.pts === p.pts);
          const prevIdx = prevRankingOrder.indexOf(p.id);
          const arrow = prevRankingOrder.length > 0 && prevIdx !== -1
            ? (prevIdx > i ? `<span style="color:#00e676;font-size:10px;font-weight:700">▲${prevIdx-i}</span>`
              : prevIdx < i ? `<span style="color:#ff5252;font-size:10px;font-weight:700">▼${i-prevIdx}</span>`
              : `<span style="color:#4a5a6e;font-size:10px">—</span>`)
            : '';
          return `<div class="match-card" style="display:flex;align-items:center;gap:12px;${i===0?"border:1px solid #FFD700;background:#181400":""}">
            <div style="text-align:center;width:32px;flex-shrink:0">
              <div style="font-size:24px;line-height:1">${medals[i]||`${i+1}º`}</div>
              <div style="min-height:14px">${arrow}</div>
            </div>
            ${av(p)}
            <div style="flex:1;min-width:0">
              <div style="font-weight:700;font-size:15px">${escapeHtml(p.name)}</div>
              ${champ?`<div style="font-size:10px;color:#8896a8;margin-top:2px">🏆 ${escapeHtml(champ)}${cp?` <span style="color:#00e676">+30</span>`:''}</div>`:''}
              ${tied?'<div style="font-size:10px;color:#6b7a8c;margin-top:2px">mesma pontuacao</div>':''}
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-size:24px;font-weight:900;color:#FFD700;line-height:1">${p.pts}</div>
              ${(penalties[p.id]||0)>0?`<div style="font-size:10px;color:#ff5252;font-weight:700">⚠️ -${penalties[p.id]}pts</div>`:''}
              <div style="font-size:10px;color:#6b7a8c">${playerFilled(p.id)}/${guessableTotal}</div>
            </div>
          </div>`;
        }).join("");
    localStorage.setItem('bcp_rank_order', JSON.stringify(newOrder));
    prevRankingOrder = newOrder;
  } else {
    const done = [...matches,...knockoutMatches].filter(m=>m.realHome!==null).sort((a,b)=>matchTime(b)-matchTime(a));
    if(done.length===0) {
      content = `<div style="text-align:center;color:#6b7a8c;padding:60px;font-size:13px">Nenhum resultado inserido ainda</div>`;
    } else {
      content = done.map(m => {
        const ph = m.phase ? KNOCKOUT_PHASES.find(p=>p.code===m.phase)?.label : `Grupo ${m.group}`;
        const rows = players.map(p=>{
          const g = guesses[p.id]?.[m.id];
          const pts = g!==undefined ? calcPts(g,m) : null;
          return {p,g,pts};
        }).sort((a,b)=>(b.pts??-1)-(a.pts??-1));
        return `<div class="match-card">
          <div style="font-size:10px;color:#6b7a8c;margin-bottom:6px;font-weight:700;letter-spacing:1px">${ph} • ${m.date}</div>
          <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:10px">
            <div style="display:flex;align-items:center;gap:4px;flex:1;justify-content:flex-end"><span class="team-name" style="text-align:right">${escapeHtml(m.home)}</span>${m.homeFlag}</div>
            <div style="background:#0d1525;border-radius:8px;padding:4px 10px;font-size:18px;font-weight:900;color:#FFD700;flex-shrink:0">${m.realHome} × ${m.realAway}</div>
            <div style="display:flex;align-items:center;gap:4px;flex:1">${m.awayFlag}<span class="team-name">${escapeHtml(m.away)}</span></div>
          </div>
          ${rows.map(({p,g,pts})=>`
            <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-top:1px solid #0d1525">
              ${av(p)}
              <span style="flex:1;font-size:13px;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(p.name)}</span>
              ${g!==undefined
                ? `<span style="color:#8896a8;font-size:12px;flex-shrink:0">${g.home}×${g.away}</span>
                   <span style="color:${COLORS[pts]};font-size:12px;font-weight:700;min-width:44px;text-align:right;flex-shrink:0">${LABELS[pts]}</span>`
                : `<span style="color:#6b7a8c;font-size:11px">sem palpite</span>`}
            </div>`).join('')}
        </div>`;
      }).join('');
    }
  }

  document.getElementById("screen-ranking").innerHTML = `
    <div class="screen">
      <div class="header">
        <button class="back-btn" onclick="goTo('home')">‹ Voltar</button>
        <div style="font-weight:800;font-size:18px">🏅 Ranking</div>
        <button onclick="openCompare()" style="background:none;border:1px solid #1a2540;border-radius:8px;color:#a8b8c8;padding:6px 10px;font-size:18px;flex-shrink:0" title="Comparar jogadores">⚖️</button>
        <button onclick="shareRanking()" style="background:none;border:1px solid #1a2540;border-radius:8px;color:#a8b8c8;padding:6px 10px;font-size:18px;flex-shrink:0" title="Compartilhar">↗</button>
      </div>
      <p style="color:#6b7a8c;text-align:center;font-size:12px;margin-bottom:12px"><span class="live-dot"></span>${playedTotal}/${matches.length+knockoutMatches.length} jogos apurados</p>
      <div style="display:flex;gap:8px;margin-bottom:14px">
        <button class="group-btn${rankingView==='players'?' active':''}" onclick="setRankingView('players')" style="flex:1">👥 Por jogador</button>
        <button class="group-btn${rankingView==='matches'?' active':''}" onclick="setRankingView('matches')" style="flex:1">📊 Por jogo</button>
      </div>
      ${content}
    </div>`;
}
window.setRankingView = function(v) { rankingView=v; renderRanking(); };

// ── ADMIN ─────────────────────────────────────────────────────────────────
function renderAdmin() {
  if(!adminUnlocked) {
    document.getElementById("screen-admin").innerHTML = `
      <div class="screen">
        <div class="header">
          <button class="back-btn" onclick="goTo('home')">‹ Voltar</button>
          <div style="font-weight:800;font-size:18px">⚙️ Admin</div>
        </div>
        <div class="card">
          <div class="label">SENHA DO ADMIN</div>
          <div style="display:flex;gap:8px">
            <input class="inp" id="admin-pass" type="password" placeholder="Senha..." onkeydown="if(event.key==='Enter')tryAdmin()"/>
            <button class="btn btn-green" onclick="tryAdmin()">›</button>
          </div>
        </div>
      </div>`;
    return;
  }
  const guessableTotal = matches.length + knockoutMatches.filter(m=>m.home!=="?"&&m.away!=="?").length;
  const playersMgmt = players.length === 0 ? "" : `
    <div class="card">
      <div class="label">PARTICIPANTES</div>
      ${players.map(p => {
        const isEditing = editingPlayerId === p.id;
        return isEditing ? `
        <div style="margin-bottom:12px;background:#0d1525;border-radius:12px;padding:12px;border:1px solid #FFD700">
          <div style="font-size:11px;color:#FFD700;font-weight:700;letter-spacing:1px;margin-bottom:8px">EDITANDO: ${escapeHtml(p.name)}</div>
          <div style="display:flex;gap:8px;margin-bottom:8px">
            <input class="inp" id="ename-${escapeHtml(p.id)}" value="${escapeHtml(p.name)}" style="flex:1" onkeydown="if(event.key==='Enter')savePlayerName(${escapeJsArg(p.id)})"/>
            <button onclick="savePlayerName(${escapeJsArg(p.id)})" style="background:#00e676;border:none;border-radius:8px;color:#000;padding:0 12px;font-size:18px;font-weight:900;cursor:pointer">✓</button>
            <button onclick="editPlayer(${escapeJsArg(p.id)})" style="background:#1a2540;border:none;border-radius:8px;color:#666;padding:0 12px;font-size:16px;cursor:pointer">✕</button>
          </div>
          <div style="font-size:11px;color:#8896a8;margin-bottom:6px">Trocar ícone:</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px">
            ${ICONS.map(ic=>`<button onclick="savePlayerIcon(${escapeJsArg(p.id)},${escapeJsArg(ic)})" style="width:30px;height:30px;font-size:16px;background:${p.icon===ic?'#2a2200':'#131929'};border:1px solid ${p.icon===ic?'#FFD700':'#1a2540'};border-radius:6px;cursor:pointer">${escapeHtml(ic)}</button>`).join('')}
          </div>
        </div>` : `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          ${av(p)}
          <span style="flex:1;font-weight:600">${escapeHtml(p.name)}</span>
          <span style="font-size:11px;color:#6b7a8c">${playerFilled(p.id)}/${guessableTotal}</span>
          <button onclick="editPlayer(${escapeJsArg(p.id)})" style="background:#1a2540;border:none;border-radius:8px;color:#aaa;padding:5px 10px;font-size:14px;cursor:pointer">✏️</button>
          <button onclick="resetPlayerOwner(${escapeJsArg(p.id)},${escapeJsArg(p.name)})" style="background:#1a2540;border:none;border-radius:8px;color:#aaa;padding:5px 10px;font-size:12px;cursor:pointer" title="Resetar sessão do dispositivo">🔗</button>
          <button onclick="adminResetPass(${escapeJsArg(p.id)},${escapeJsArg(p.name)})" style="background:#1a2540;border:none;border-radius:8px;color:#aaa;padding:5px 10px;font-size:12px;cursor:pointer" title="Redefinir senha">🔑</button>
          <button onclick="deletePlayer(${escapeJsArg(p.id)},${escapeJsArg(p.name)})" style="background:#c62828;border:none;border-radius:8px;color:#fff;padding:5px 10px;font-size:12px;font-weight:700;cursor:pointer">🗑️</button>
        </div>`;
      }).join('')}
    </div>`;

  // ── Campeão ──
  const champCard = `<div class="card">
    <div class="label">🏆 CAMPEÃO REAL</div>
    <button onclick="openAdminChampPicker()" style="width:100%;background:#0d1525;border:1px solid ${realChampion?'#FFD700':'#1a2540'};border-radius:10px;padding:12px 14px;color:#fff;text-align:left;display:flex;align-items:center;gap:10px;cursor:pointer">
      ${realChampion?`${fl(realChampion)}<span style="font-weight:700;flex:1">${escapeHtml(realChampion)}</span>`:'<span style="color:#8896a8;flex:1">Selecionar país campeão...</span>'}
      <span style="color:#8896a8;font-size:18px">›</span>
    </button>
    ${realChampion?`<div style="margin-top:8px;font-size:13px;color:#8896a8">Atual: <b style="color:#00e676">${escapeHtml(realChampion)}</b></div>`:''}
  </div>`;

  // ── Resultados grupos ──
  const groups = ["Todos",...Array.from(new Set(matches.map(m=>m.group))).sort()];
  const visibleG = adminFilter==="Todos" ? matches : matches.filter(m=>m.group===adminFilter);
  const groupBtns = groups.map(g=>`<button class="group-btn${adminFilter===g?" active":""}" onclick="setAdminFilter('${g}')">${g==="Todos"?"Todos":"G"+g}</button>`).join("");
  let groupCards = "";
  visibleG.forEach(m => {
    groupCards += `<div class="match-card">
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#6b7a8c;margin-bottom:8px">
        <span style="color:#FFD700;font-weight:700">Grupo ${m.group} • R${m.rodada}</span><span>${m.date} ${m.time}</span>
      </div>
      <div style="margin-bottom:8px">${matchStatusBadge(m)}</div>
      <div class="match-teams-row">
        <div class="team-side"><span style="font-size:20px;flex-shrink:0">${m.homeFlag}</span><span class="team-name">${escapeHtml(m.home)}</span></div>
        <div class="score-box">
          <input class="score-inp" data-mid="${m.id}" data-side="home" value="${m.realHome!==null?m.realHome:''}" placeholder="?" oninput="this.value=this.value.replace(/\\D/g,'').slice(0,2)" onblur="autoSaveAdminResult(${m.id}, 'group')" inputmode="numeric"/>
          <span style="color:#4a5a6e;font-weight:700">×</span>
          <input class="score-inp" data-mid="${m.id}" data-side="away" value="${m.realAway!==null?m.realAway:''}" placeholder="?" oninput="this.value=this.value.replace(/\\D/g,'').slice(0,2)" onblur="autoSaveAdminResult(${m.id}, 'group')" inputmode="numeric"/>
        </div>
        <div class="team-side" style="justify-content:flex-end"><span class="team-name" style="text-align:right">${escapeHtml(m.away)}</span><span style="font-size:20px;flex-shrink:0">${m.awayFlag}</span></div>
      </div>
      <div class="save-hint">${savedAdminResultFeedback[m.id] || ''}</div>
    </div>`;
  });

  // ── Times da fase eliminatória ──
  const teamsCard = `<div class="card">
    <div class="label">FASE ELIMINATÓRIA — DEFINIR TIMES</div>
    ${KNOCKOUT_PHASES.map(ph=>{
      const phM = knockoutMatches.filter(m=>m.phase===ph.code);
      return `<div style="margin-bottom:14px">
        <div style="font-size:11px;color:#FFD700;font-weight:700;letter-spacing:1px;margin-bottom:6px">${ph.label}</div>
        ${phM.map(m=>`<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">
          <span style="font-size:10px;color:#6b7a8c;width:42px;flex-shrink:0">${m.date}</span>
          <input class="inp" data-kid="${m.id}" data-side="home" value="${m.home==='?'?'':escapeHtml(m.home)}" placeholder="Time A..." list="admin-teams-dl" style="flex:1;font-size:12px;padding:8px 10px"/>
          <span style="color:#333;font-size:12px">×</span>
          <input class="inp" data-kid="${m.id}" data-side="away" value="${m.away==='?'?'':escapeHtml(m.away)}" placeholder="Time B..." list="admin-teams-dl" style="flex:1;font-size:12px;padding:8px 10px"/>
        </div>`).join('')}
      </div>`;
    }).join('')}
    <datalist id="admin-teams-dl">
      ${Object.keys(ISO).sort().map(t=>`<option value="${escapeHtml(t)}">`).join('')}
    </datalist>
    <button class="btn-gold" onclick="saveKnockoutTeams()">💾 Salvar Times</button>
  </div>`;

  // ── Resultados fase eliminatória ──
  const koWithTeams = knockoutMatches.filter(m=>m.home!=="?"&&m.away!=="?");
  let koResultCards = "";
  koWithTeams.forEach(m => {
    const ph = KNOCKOUT_PHASES.find(p=>p.code===m.phase);
    koResultCards += `<div class="match-card">
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#6b7a8c;margin-bottom:8px">
        <span style="color:#FFD700;font-weight:700">${ph?.label||m.phase} • ${m.date}</span>
      </div>
      <div style="margin-bottom:8px">${matchStatusBadge(m)}</div>
      <div class="match-teams-row">
        <div class="team-side"><span style="font-size:20px;flex-shrink:0">${m.homeFlag}</span><span class="team-name">${escapeHtml(m.home)}</span></div>
        <div class="score-box">
          <input class="score-inp" data-krid="${m.id}" data-side="home" value="${m.realHome!==null?m.realHome:''}" placeholder="?" oninput="this.value=this.value.replace(/\\D/g,'').slice(0,2)" onblur="autoSaveAdminResult(${m.id}, 'ko')" inputmode="numeric"/>
          <span style="color:#4a5a6e;font-weight:700">×</span>
          <input class="score-inp" data-krid="${m.id}" data-side="away" value="${m.realAway!==null?m.realAway:''}" placeholder="?" oninput="this.value=this.value.replace(/\\D/g,'').slice(0,2)" onblur="autoSaveAdminResult(${m.id}, 'ko')" inputmode="numeric"/>
        </div>
        <div class="team-side" style="justify-content:flex-end"><span class="team-name" style="text-align:right">${escapeHtml(m.away)}</span><span style="font-size:20px;flex-shrink:0">${m.awayFlag}</span></div>
      </div>
      <div class="save-hint">${savedAdminResultFeedback[m.id] || ''}</div>
    </div>`;
  });
  const koResultsCard = `<div class="card">
    <div class="label">FASE ELIMINATÓRIA — RESULTADOS</div>
    ${koWithTeams.length===0
      ? '<p style="color:#6b7a8c;font-size:12px;text-align:center;padding:12px">Defina os times primeiro</p>'
      : koResultCards + '<button class="btn-gold" onclick="saveKnockoutResults()">💾 Salvar Resultados Eliminatória</button>'}
  </div>`;

  const autoResultsCard = `<div class="card">
    <div class="label">RESULTADOS AUTOMATICOS</div>
    <p style="font-size:12px;color:#8896a8;line-height:1.5;margin-bottom:10px">Busca placares finais quando o admin autenticado abre o app. O admin ainda pode corrigir qualquer resultado manualmente.</p>
    <div style="display:flex;align-items:center;gap:8px">
      <span style="flex:1;font-size:12px;color:#a8b8c8">${escapeHtml(autoResultsStatus)}</span>
      <button onclick="runAutoResultSync(true)" class="btn btn-outline" style="flex:0 0 auto;padding:9px 12px">Buscar agora</button>
    </div>
  </div>`;
  const adminTabs = `
    <div class="groups-scroll" style="margin-bottom:12px">
      ${[
        ['participantes','Participantes'],
        ['resultados','Resultados'],
        ['eliminatoria','Eliminatoria'],
        ['config','Config'],
        ['auditoria','🔍 Auditoria']
      ].map(([code,label]) => `<button class="group-btn${adminTab===code?' active':''}" onclick="setAdminTab('${code}')">${label}</button>`).join('')}
    </div>`;
  const adminUid = auth.currentUser?.uid || '(faça login como admin para ver)';
  const matchTimesCard = `<div class="card">
    <div class="label">🔒 TRAVA SERVER-SIDE DE PALPITES</div>
    <p style="font-size:12px;color:#8896a8;line-height:1.5;margin-bottom:8px">Semeia <b>/match_times</b> no Firebase com o horário de cada jogo. As Security Rules usam esse dado para bloquear palpites no servidor após o início do jogo.</p>
    <button onclick="syncMatchTimes()" class="btn btn-outline" style="width:100%;padding:9px">⏱️ Sincronizar horários dos jogos</button>
  </div>`;
  const authSetupCard = `<div class="card">
    <div class="label">AUTENTICAÇÃO DO ADMIN</div>
    <p style="font-size:12px;color:#8896a8;line-height:1.5;margin-bottom:8px">Para salvar resultados, adicione seu UID no Firebase Console → Realtime Database → <b>/admins/{UID}</b> = <b>true</b>.</p>
    <div style="background:#0d1525;border-radius:8px;padding:10px;margin-bottom:8px">
      <div style="font-size:10px;color:#FFD700;font-weight:700;letter-spacing:1px;margin-bottom:4px">SEU UID ATUAL</div>
      <div style="font-size:11px;color:#ccc;word-break:break-all;font-family:monospace">${escapeHtml(adminUid)}</div>
    </div>
    <button onclick="navigator.clipboard.writeText(${escapeJsArg(adminUid)}).then(()=>showToast('UID copiado!'))" class="btn btn-outline" style="width:100%;padding:9px">📋 Copiar UID</button>
  </div>`;
  const adminContent = adminTab === 'participantes'
    ? `${playersMgmt || '<div class="card"><p style="color:#6b7a8c;font-size:12px;text-align:center">Nenhum participante ainda</p></div>'}`
    : adminTab === 'resultados'
      ? `${autoResultsCard}
        <div class="label" style="margin-bottom:10px">RESULTADOS — GRUPOS</div>
        <div class="groups-scroll">${groupBtns}</div>
        ${groupCards}
        <button class="btn-gold" onclick="saveGroupResults()">💾 Salvar Resultados Grupos</button>`
      : adminTab === 'eliminatoria'
        ? `${teamsCard}${koResultsCard}`
        : adminTab === 'auditoria'
          ? `<div class="card"><div class="label">LOG DE ALTERAÇÕES DE PALPITES</div><div id="audit-log-content" style="font-size:12px;color:#8896a8;text-align:center;padding:20px">Carregando...</div></div>`
          : `${champCard}${autoResultsCard}${authSetupCard}${matchTimesCard}`;

  document.getElementById("screen-admin").innerHTML = `
    <div class="screen">
      <div class="header">
        <button class="back-btn" onclick="goTo('home')">‹ Voltar</button>
        <div style="font-weight:800;font-size:18px">⚙️ Admin</div>
        <button onclick="logoutAdmin()" style="background:none;border:1px solid #1a2540;border-radius:8px;color:#a8b8c8;padding:6px 10px;font-size:12px;flex-shrink:0">Sair</button>
      </div>
      ${adminTabs}
      ${adminContent}
    </div>`;
}
window.setAdminTab = function(tab) {
  adminTab = tab;
  renderAdmin();
  if(tab === 'auditoria') loadAuditLog();
};

window.loadAuditLog = async function(filterSuspect = false) {
  const el = document.getElementById('audit-log-content');
  if(!el) return;
  try {
    const snap = await db.ref('audit_log').orderByChild('ts').limitToLast(200).once('value');
    const entries = [];
    snap.forEach(child => entries.push({...child.val(), _key: child.key}));
    entries.reverse();
    if(!entries.length) { el.innerHTML = '<span style="color:#6b7a8c">Nenhuma alteração registrada ainda.</span>'; return; }
    const getMatch = id => [...matches,...knockoutMatches].find(m=>m.id===id);
    const matchLabel = id => {
      const m = getMatch(id);
      if(!m) return `Jogo #${id}`;
      const ph = m.phase ? (KNOCKOUT_PHASES.find(p=>p.code===m.phase)?.label||m.phase) : `Grupo ${m.group}`;
      return `${ph} • ${m.date} ${m.home} × ${m.away}`;
    };
    const withFlags = entries.map(e => {
      const m = getMatch(e.matchId);
      const start = m ? matchTime(m) : null;
      return {...e, isSuspect: start !== null && e.ts >= start};
    });
    const suspects = withFlags.filter(e => e.isSuspect);
    const toShow = filterSuspect ? suspects : withFlags;
    const filterBtn = filterSuspect
      ? `<button onclick="loadAuditLog(false)" style="background:#1e2d3d;color:#8896a8;border:1px solid #2a3a4e;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:12px">Mostrar todos (${withFlags.length})</button>`
      : `<button onclick="loadAuditLog(true)" style="background:#3d1515;color:#ff5252;border:1px solid #ff525255;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:12px">⚠️ Apenas suspeitos (${suspects.length})</button>`;
    el.innerHTML = `<div style="margin-bottom:12px;display:flex;align-items:center;gap:10px">${filterBtn}${suspects.length>0?`<span style="color:#ff5252;font-size:11px;font-weight:700">${suspects.length} palpite(s) alterado(s) após início do jogo</span>`:''}</div>` +
      (toShow.length === 0 ? '<span style="color:#6b7a8c">Nenhuma entrada suspeita encontrada.</span>' :
      toShow.map(e => {
        const d = new Date(e.ts);
        const timeStr = `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`;
        const prevStr = e.prev !== null ? `${e.prev.home}×${e.prev.away}` : '—';
        const nextStr = `${e.next.home}×${e.next.away}`;
        const changed = e.prev !== null;
        const border = e.isSuspect ? '2px solid #ff525288' : '1px solid #0d1525';
        const badge = e.isSuspect ? `<span style="background:#ff525222;color:#ff5252;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;border:1px solid #ff525244">⚠️ SUSPEITO</span>` : '';
        const revertBtn = e.isSuspect && e.prev !== null
          ? e.reverted
            ? `<span style="color:#4a5a6e;font-size:11px;margin-top:4px">✅ Revertido</span>`
            : `<button onclick="revertGuess('${e.playerId}',${e.matchId},${e.prev.home},${e.prev.away},'${e._key}','${escapeHtml(e.playerName||e.playerId)}')" style="background:#3d1515;color:#ff5252;border:1px solid #ff525255;border-radius:4px;padding:3px 8px;cursor:pointer;font-size:11px;margin-top:4px">↩ Reverter para ${prevStr} e punir -15pts</button>`
          : '';
        return `<div style="border-top:${border};padding:8px 0;display:flex;flex-direction:column;gap:2px${e.isSuspect?' background:#ff52520a;margin:0 -8px;padding-left:8px;padding-right:8px':''}">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
            <div style="display:flex;align-items:center;gap:6px"><span style="font-weight:700;color:#fff">${escapeHtml(e.playerName||e.playerId)}</span>${badge}</div>
            <span style="color:#4a5a6e;font-size:11px;white-space:nowrap">${timeStr}</span>
          </div>
          <div style="color:#8896a8;font-size:11px">${escapeHtml(matchLabel(e.matchId))}</div>
          <div style="font-size:12px">${changed?`<span style="color:#ff5252">${prevStr}</span> → `:''}<span style="color:#00e676">${nextStr}</span>${changed?'':' <span style="color:#4a5a6e">(novo)</span>'}</div>
          ${revertBtn}
        </div>`;
      }).join(''));
  } catch(err) {
    el.innerHTML = '<span style="color:#ff5252">Erro ao carregar log. Verifique as regras do Firebase.</span>';
  }
};

window.revertGuess = async function(playerId, matchId, home, away, logKey, playerName) {
  if(!confirm(`Reverter palpite de ${playerName||playerId} para ${home}×${away} e aplicar -15pts de punição?`)) return;
  try {
    await db.ref(`guesses/${playerId}/${matchId}`).set({home, away});
    await db.ref(`penalties/${playerId}`).transaction(cur => (cur || 0) + 15);
    await db.ref(`audit_log/${logKey}`).update({reverted: true});
    showToast(`Palpite revertido e -15pts aplicados a ${playerName||playerId} ✅`);
    loadAuditLog(true);
  } catch(e) {
    showToast("Erro ao reverter. Verifique permissões do Firebase.", "err");
  }
};

window.tryAdmin = async function() {
  const pass = document.getElementById("admin-pass").value;
  if(pass === ADMIN_PASSWORD) {
    adminUnlocked = true;
    try {
      const user = await ensureAnonymousAuth();
      if(user) await db.ref(`admins/${user.uid}`).set(true);
    } catch(e) {
      showToast("Admin local OK, mas sem permissão no Firebase (verifique as regras)", "err");
    }
    showToast("Admin autenticado!");
    renderAdmin();
  } else {
    showToast("Senha do admin incorreta","err");
  }
};
window.logoutAdmin = function() {
  adminUnlocked = false;
  renderAdmin();
};

window.setAdminFilter = function(g) { adminFilter=g; renderAdmin(); };

window.autoSaveAdminResult = async function(mid, source) {
  if(!adminUnlocked) return;
  const attr = source === 'ko' ? 'data-krid' : 'data-mid';
  const hi = document.querySelector(`#screen-admin .score-inp[${attr}="${mid}"][data-side="home"]`);
  const ai = document.querySelector(`#screen-admin .score-inp[${attr}="${mid}"][data-side="away"]`);
  if(!hi || !ai || hi.value === "" || ai.value === "") return;

  const m = [...matches, ...knockoutMatches].find(game => game.id === mid);
  if(m && m.realHome === +hi.value && m.realAway === +ai.value) return;

  try {
    await db.ref(`results/${mid}`).set({home:+hi.value, away:+ai.value});
  } catch (err) {
    showToast("Nao foi possivel salvar o placar","err");
    return;
  }

  savedAdminResultFeedback[mid] = "placar salvo";
  showToast("Placar salvo automaticamente!");
  const card = hi.closest('.match-card');
  if(card) {
    card.style.outline = '2px solid #00e676';
    setTimeout(() => { card.style.outline = ''; }, 1000);
  }
  setTimeout(() => {
    delete savedAdminResultFeedback[mid];
    rerender(["admin"]);
  }, 1400);
};

window.syncMatchTimes = async function() {
  try {
    const times = {};
    [...matches, ...knockoutMatches].forEach(m => { times[m.id] = matchTime(m); });
    await db.ref('match_times').set(times);
    showToast(`${Object.keys(times).length} horários sincronizados ✅`);
  } catch(e) {
    showToast('Erro ao sincronizar. Verifique permissões do Firebase.', 'err');
  }
};

window.adminResetPass = async function(id, name) {
  const newPass = prompt(`Nova senha para ${name}:`);
  if(!newPass) return;
  if(newPass.length < 3) { showToast('Senha muito curta (mín. 3 caracteres)', 'err'); return; }
  try {
    const fields = await makePasswordFields(newPass);
    await db.ref(`players/${id}`).update({...fields, pass: null});
    showToast(`Senha de ${name} redefinida ✅`);
  } catch(e) {
    showToast('Erro ao redefinir senha. Verifique permissões do Firebase.', 'err');
  }
};

window.deletePlayer = async function(id, name) {
  if(!confirm(`Remover ${name} do bolão? Essa ação também apaga os palpites dele.`)) return;
  try {
    await db.ref().update({
      [`players/${id}`]: null,
      [`guesses/${id}`]: null,
      [`champion_guesses/${id}`]: null
    });
  } catch (err) {
    showToast("Nao foi possivel remover participante","err");
    return;
  }
  if(myPlayerId === id) { myPlayerId = null; localStorage.removeItem('bcp_me'); }
  showToast(`${name} removido do bolão`);
  renderAdmin();
};

window.resetPlayerOwner = async function(id, name) {
  if(!confirm(`Resetar sessão de ${name}?\nNa próxima vez que entrar com a senha, o dispositivo será vinculado novamente.`)) return;
  try {
    await db.ref(`players/${id}/ownerUid`).remove();
    showToast(`Sessão de ${name} resetada!`);
  } catch(err) {
    showToast("Sem permissão. Seu UID precisa estar em /admins no Firebase.", "err");
  }
};
window.editPlayer = function(id) {
  editingPlayerId = editingPlayerId === id ? null : id;
  renderAdmin();
};

window.savePlayerName = async function(id) {
  const newName = document.getElementById(`ename-${id}`).value.trim();
  if(!newName) { showToast("Nome não pode ser vazio!", "err"); return; }
  if(players.find(p=>p.id!==id && p.name.toLowerCase()===newName.toLowerCase())) {
    showToast("Nome já existe!", "err"); return;
  }
  try { await db.ref(`players/${id}/name`).set(newName); }
  catch (err) { showToast("Nao foi possivel atualizar o nome","err"); return; }
  editingPlayerId = null;
  showToast("Nome atualizado! ✅");
};

window.savePlayerIcon = async function(id, icon) {
  try { await db.ref(`players/${id}/icon`).set(icon); }
  catch (err) { showToast("Nao foi possivel atualizar o icone","err"); return; }
  editingPlayerId = null;
  showToast("Ícone atualizado! ✅");
};

window.saveGroupResults = async function() {
  const inputs = document.querySelectorAll("#screen-admin [data-mid]");
  const pairs = {};
  inputs.forEach(inp => {
    const mid = +inp.dataset.mid;
    if(!pairs[mid]) pairs[mid] = {};
    pairs[mid][inp.dataset.side] = inp.value;
  });
  const updates = {};
  Object.entries(pairs).forEach(([mid, sides]) => {
    if(sides.home !== "" && sides.away !== "") {
      updates[`results/${mid}/home`] = +sides.home;
      updates[`results/${mid}/away`] = +sides.away;
    }
  });
  if(!Object.keys(updates).length) { showToast("Nenhum resultado para salvar!","err"); return; }
  try { await db.ref().update(updates); }
  catch (err) { showToast("Nao foi possivel salvar resultados","err"); return; }
  showToast("Resultados salvos! ✅");
};

window.saveKnockoutTeams = async function() {
  const inputs = document.querySelectorAll("#screen-admin [data-kid]");
  const updates = {};
  inputs.forEach(inp => {
    const kid = +inp.dataset.kid, side = inp.dataset.side;
    const v = inp.value.trim();
    if(v) updates[`knockout_teams/${kid}/${side}`] = v;
  });
  if(!Object.keys(updates).length) { showToast("Preencha ao menos um time!","err"); return; }
  try { await db.ref().update(updates); }
  catch (err) { showToast("Nao foi possivel salvar os times","err"); return; }
  showToast("Times salvos! ✅");
};

window.saveKnockoutResults = async function() {
  const inputs = document.querySelectorAll("#screen-admin [data-krid]");
  const pairs = {};
  inputs.forEach(inp => {
    const mid = +inp.dataset.krid;
    if(!pairs[mid]) pairs[mid] = {};
    pairs[mid][inp.dataset.side] = inp.value;
  });
  const updates = {};
  Object.entries(pairs).forEach(([mid, sides]) => {
    if(sides.home !== "" && sides.away !== "") {
      updates[`results/${mid}/home`] = +sides.home;
      updates[`results/${mid}/away`] = +sides.away;
    }
  });
  if(!Object.keys(updates).length) { showToast("Nenhum resultado para salvar!","err"); return; }
  try { await db.ref().update(updates); }
  catch (err) { showToast("Nao foi possivel salvar resultados","err"); return; }
  showToast("Resultados eliminatória salvos! ✅");
};

window.saveRealChampion = async function() {
  const inp = document.getElementById("admin-champ");
  if(!inp) { openAdminChampPicker(); return; }
  const v = inp.value.trim();
  if(!v) { showToast("Informe o país campeão!","err"); return; }
  try { await db.ref("champion").set(v); }
  catch (err) { showToast("Nao foi possivel registrar o campeao","err"); return; }
  showToast("Campeão registrado! 🏆");
};

// ── Modal de regras ───────────────────────────────────────────────────────
window.openRules = function() { document.getElementById("modal-rules").style.display="flex"; };
window.closeRules = function() { document.getElementById("modal-rules").style.display="none"; };

// ── Modal de senha ────────────────────────────────────────────────────────
function closeModal() { document.getElementById("modal-pass").style.display="none"; }

window.confirmPass = async function() {
  const player = players.find(p=>p.id===pendingPlayerId);
  const entered = document.getElementById("modal-pass-inp").value;
  if(await verifyPlayerPassword(player, entered)) {
    await migrateLegacyPassword(player, entered);
    await ensurePlayerOwner(player);
    myPlayerId = pendingPlayerId; localStorage.setItem('bcp_me', pendingPlayerId);
    closeModal(); currentPlayer = player; gameFilter="Todos"; goTo("game");
  } else {
    showToast("Senha incorreta!","err");
    document.getElementById("modal-pass-inp").value = "";
  }
};

window.viewOnly = function() {
  currentPlayer = players.find(p=>p.id===pendingPlayerId);
  closeModal(); gameFilter="Todos"; goTo("game");
};

// ── Trocar senha ─────────────────────────────────────────────────────────
window.openChangePass = function() {
  if(!currentPlayer) return;
  document.getElementById('changepass-name').textContent = currentPlayer.name;
  document.getElementById('cp-current').value = '';
  document.getElementById('cp-new').value = '';
  document.getElementById('cp-confirm').value = '';
  document.getElementById('modal-changepass').style.display = 'flex';
  setTimeout(() => document.getElementById('cp-current').focus(), 100);
};
window.closeChangePass = function() {
  document.getElementById('modal-changepass').style.display = 'none';
};
window.saveNewPass = async function() {
  if(!currentPlayer) return;
  const cur = document.getElementById('cp-current').value;
  const nw = document.getElementById('cp-new').value;
  const cf = document.getElementById('cp-confirm').value;
  if(!cur || !nw || !cf) { showToast('Preencha todos os campos','err'); return; }
  if(nw.length < 3) { showToast('Nova senha muito curta (mín. 3 caracteres)','err'); return; }
  if(nw !== cf) { showToast('Senhas não coincidem','err'); return; }
  const player = players.find(p => p.id === currentPlayer.id);
  if(!player) return;
  if(!await verifyPlayerPassword(player, cur)) { showToast('Senha atual incorreta','err'); return; }
  await db.ref(`players/${currentPlayer.id}`).update({...await makePasswordFields(nw), pass:null});
  closeChangePass();
  showToast('Senha alterada com sucesso! ✅');
};

// ── Comparação entre jogadores ────────────────────────────────────────────
window.openCompare = function() {
  const opts = players.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join('');
  document.getElementById('compare-p1').innerHTML = '<option value="">Jogador 1...</option>' + opts;
  document.getElementById('compare-p2').innerHTML = '<option value="">Jogador 2...</option>' + opts;
  if(myPlayerId) document.getElementById('compare-p1').value = myPlayerId;
  document.getElementById('compare-body').innerHTML = '<p style="text-align:center;color:#6b7a8c;padding:20px">Selecione dois jogadores</p>';
  document.getElementById('modal-compare').style.display = 'flex';
  if(myPlayerId) renderCompareModal();
};
window.closeCompare = function() {
  document.getElementById('modal-compare').style.display = 'none';
};
window.renderCompareModal = function() {
  const p1id = document.getElementById('compare-p1').value;
  const p2id = document.getElementById('compare-p2').value;
  const body = document.getElementById('compare-body');
  if(!p1id || !p2id || p1id === p2id) {
    body.innerHTML = '<p style="text-align:center;color:#6b7a8c;padding:20px">Selecione dois jogadores diferentes</p>';
    return;
  }
  const p1 = players.find(p => p.id === p1id);
  const p2 = players.find(p => p.id === p2id);
  const COLORS = {10:"#00e676",7:"#69f0ae",5:"#b2ff59",0:"#ff5252"};
  const done = [...matches,...knockoutMatches].filter(m => m.realHome !== null);
  const p1pts = playerTotalPts(p1id), p2pts = playerTotalPts(p2id);
  const p1wins = done.filter(m => { const g1=guesses[p1id]?.[m.id], g2=guesses[p2id]?.[m.id]; return g1&&g2&&calcPts(g1,m)>calcPts(g2,m); }).length;
  const p2wins = done.filter(m => { const g1=guesses[p1id]?.[m.id], g2=guesses[p2id]?.[m.id]; return g1&&g2&&calcPts(g2,m)>calcPts(g1,m); }).length;
  let html = `<div style="display:flex;gap:8px;margin-bottom:12px">
    <div style="flex:1;text-align:center;background:#0d1525;border-radius:10px;padding:10px;border:1px solid ${p1pts>=p2pts?'#FFD700':'#1a2540'}">
      ${av(p1)}<div style="font-weight:700;margin-top:4px;font-size:13px">${escapeHtml(p1.name)}</div>
      <div style="font-size:22px;font-weight:900;color:#FFD700">${p1pts}<span style="font-size:10px;color:#6b7a8c"> pts</span></div>
      <div style="font-size:10px;color:#00e676;margin-top:2px">Venceu ${p1wins}× nos duelos</div>
    </div>
    <div style="flex:1;text-align:center;background:#0d1525;border-radius:10px;padding:10px;border:1px solid ${p2pts>p1pts?'#FFD700':'#1a2540'}">
      ${av(p2)}<div style="font-weight:700;margin-top:4px;font-size:13px">${escapeHtml(p2.name)}</div>
      <div style="font-size:22px;font-weight:900;color:#FFD700">${p2pts}<span style="font-size:10px;color:#6b7a8c"> pts</span></div>
      <div style="font-size:10px;color:#00e676;margin-top:2px">Venceu ${p2wins}× nos duelos</div>
    </div>
  </div>`;
  if(!done.length) { body.innerHTML = html + '<p style="text-align:center;color:#6b7a8c;padding:12px;font-size:13px">Nenhum jogo apurado ainda</p>'; return; }
  done.forEach(m => {
    const g1 = guesses[p1id]?.[m.id], g2 = guesses[p2id]?.[m.id];
    const pts1 = g1!==undefined ? calcPts(g1,m) : null;
    const pts2 = g2!==undefined ? calcPts(g2,m) : null;
    const ph = m.phase ? KNOCKOUT_PHASES.find(p=>p.code===m.phase)?.label : `Grupo ${m.group}`;
    html += `<div style="background:#0d1525;border-radius:10px;padding:10px;margin-bottom:8px">
      <div style="font-size:10px;color:#6b7a8c;margin-bottom:6px">${escapeHtml(ph)} • ${m.date} • <b style="color:#fff">${escapeHtml(m.home)} ${m.realHome}×${m.realAway} ${escapeHtml(m.away)}</b></div>
      <div style="display:flex;gap:6px">
        <div style="flex:1;text-align:center;padding:8px 4px;border-radius:8px;background:#131929;${pts1!==null?'border-left:3px solid '+COLORS[pts1]:'opacity:.5'}">
          ${g1!==undefined?`<div style="font-weight:700;font-size:16px">${g1.home}×${g1.away}</div><div style="font-size:11px;color:${COLORS[pts1??0]}">${pts1!==null?'+'+pts1+'pts':'—'}</div>`:'<div style="color:#6b7a8c;font-size:11px;padding:4px">sem<br>palpite</div>'}
        </div>
        <div style="flex:1;text-align:center;padding:8px 4px;border-radius:8px;background:#131929;${pts2!==null?'border-left:3px solid '+COLORS[pts2]:'opacity:.5'}">
          ${g2!==undefined?`<div style="font-weight:700;font-size:16px">${g2.home}×${g2.away}</div><div style="font-size:11px;color:${COLORS[pts2??0]}">${pts2!==null?'+'+pts2+'pts':'—'}</div>`:'<div style="color:#6b7a8c;font-size:11px;padding:4px">sem<br>palpite</div>'}
        </div>
      </div>
    </div>`;
  });
  body.innerHTML = html;
};

// ── Notificações ─────────────────────────────────────────────────────────
function maybeNotify(mid, res) {
  if(notifiedResults.has(mid)) return;
  notifiedResults.add(mid);
  localStorage.setItem('bcp_notified', JSON.stringify([...notifiedResults]));
  if(Notification.permission !== 'granted') return;
  const m = [...matches,...knockoutMatches].find(m=>m.id===mid);
  if(!m) return;
  const label = m.phase
    ? (KNOCKOUT_PHASES.find(p=>p.code===m.phase)?.label || m.phase)
    : `Grupo ${m.group}`;
  const title = `⚽ ${m.home} ${res.home} × ${res.away} ${m.away}`;
  new Notification(title, {body:`${label} • ${m.date} ${m.time} — resultado inserido!`, icon:'icon.svg'});
}

window.requestNotifPerm = async function() {
  if(!('Notification' in window)) { showToast('Notificações não suportadas','err'); return; }
  const perm = await Notification.requestPermission();
  if(perm === 'granted') showToast('Notificações ativadas! 🔔');
  else if(perm === 'denied') showToast('Notificações bloqueadas no navegador','err');
  renderHome();
};

// ── Compartilhar ranking ──────────────────────────────────────────────────
window.shareRanking = async function() {
  const ranking = players.map(p=>({...p,pts:playerTotalPts(p.id)})).sort((a,b)=>b.pts-a.pts);
  const medals = ["🥇","🥈","🥉"];
  const playedTotal = matches.filter(m=>m.realHome!==null).length + knockoutMatches.filter(m=>m.realHome!==null).length;
  let text = `🏆 Bolão Copa 2026 — Ranking\n📊 ${playedTotal} jogos apurados\n\n`;
  ranking.forEach((p,i) => { text += `${medals[i]||`${i+1}º`} ${p.name} — ${p.pts} pts\n`; });
  text += `\nhttps://leydson17.github.io/bolao-copa`;
  if(navigator.share) {
    try { await navigator.share({title:'Bolão Copa 2026', text}); } catch(e) {}
  } else {
    try { await navigator.clipboard.writeText(text); showToast('Ranking copiado! 📋'); }
    catch(e) { showToast('Não foi possível copiar','err'); }
  }
};

// ── Init ──────────────────────────────────────────────────────────────────
// Scroll mínimo ao focar input de placar (evita rolar demais no iOS)
document.addEventListener('focusin', e => {
  if(e.target.classList.contains('score-inp')) {
    setTimeout(() => e.target.scrollIntoView({block:'nearest',behavior:'instant'}), 350);
  }
});

// ── One-time: palpite p_1779847664133 nas oitavas Marrocos×Canadá (2×0) ──
(function watchGuessMarrocosCanada() {
  const ref = db.ref('knockout_teams');
  ref.on('value', snap => {
    const teams = snap.val() || {};
    const match = BASE_KNOCKOUT.find(m => {
      if(m.phase !== 'R16') return false;
      const home = teams[m.id]?.home || m.defaultHome;
      const away = teams[m.id]?.away || m.defaultAway;
      return (home === 'Marrocos' && away === 'Canadá') || (home === 'Canadá' && away === 'Marrocos');
    });
    if(!match) return;
    ref.off();
    const home = teams[match.id]?.home || match.defaultHome;
    const score = home === 'Marrocos' ? {home:2, away:0} : {home:0, away:2};
    db.ref(`guesses/p_1779847664133/${match.id}`).set(score);
  });
})();

initFirebase();
renderHome();
