import catalog from './football-leagues.json';
export const LEAGUES = catalog.leagues;
export const CATALOG_UPDATED_AT = catalog.updatedAt;
const countries = { Russia: 'Россия', England: 'Англия', Spain: 'Испания', Italy: 'Италия', Germany: 'Германия', France: 'Франция', World: 'Международные', Portugal: 'Португалия', Brazil: 'Бразилия', Argentina: 'Аргентина' };
export const findLeague = id => LEAGUES.find(league => String(league.id) === String(id));
export const leagueLabel = league => `${countries[league.country] || league.country} · ${league.name}`;
export const searchLeagues = text => LEAGUES.filter(league => `${league.country} ${leagueLabel(league)}`.toLowerCase().includes(text.trim().toLowerCase()));
export function seasonsFor(league, allowed = []) {
  return (league?.seasons || []).filter(season => !allowed.length || allowed.includes(season.year)).slice().sort((a,b) => b.year-a.year);
}
export function seasonForDate(league, date, allowed = []) {
  const seasons = seasonsFor(league, allowed);
  return seasons.find(season => date >= season.start && date <= season.end) || seasons.find(season => season.current) || seasons[0];
}
