import type { WorkflowConfig } from '@/domain/ai/AgentApi'

type Feed = NonNullable<WorkflowConfig['source']['feeds']>[number]

const q = (path: string) => `https://news.google.com/rss/search?q=${path}`

/** The news searches S&B starts from: migrant workers and the Gulf, the states people leave from, and the languages they read. Change any. */
export const SB_FEEDS: Feed[] = [
  { lang: 'en', key: 'migrant_general', url: q('migrant+AND+India%20when%3A7d&hl=en-IN&gl=IN&ceid=IN%3Aen') },
  { lang: 'en', key: 'migrant_workers', url: q('%22migrant+workers%22+AND+India%20when%3A7d&hl=en-IN&gl=IN&ceid=IN%3Aen') },
  { lang: 'en', key: 'gulf_migrant_labor', url: q('%22migrant%22+AND+%22Gulf%22+AND+%22labor%22%20when%3A7d&hl=en-IN&gl=IN&ceid=IN%3Aen') },
  { lang: 'en', key: 'telangana_gulf', url: q('%28Telangana+OR+Hyderabad%29+AND+%28Gulf+OR+migrant+OR+NRI%29%20when%3A7d&hl=en-IN&gl=IN&ceid=IN%3Aen') },
  { lang: 'en', key: 'kerala_norka', url: q('%28Kerala+OR+NORKA%29+AND+%28Gulf+OR+migrant+OR+Pravasi%29%20when%3A7d&hl=en-IN&gl=IN&ceid=IN%3Aen') },
  { lang: 'en', key: 'bihar_migrants', url: q('%22Bihar%22+AND+%22migrant+workers%22%20when%3A7d&hl=en-IN&gl=IN&ceid=IN%3Aen') },
  { lang: 'en', key: 'odisha_migrants', url: q('%22Odisha%22+AND+%28%22migrant+workers%22+OR+Dadani%29%20when%3A7d&hl=en-IN&gl=IN&ceid=IN%3Aen') },
  { lang: 'en', key: 'maharashtra_migrants', url: q('%22Maharashtra%22+AND+%22migrant+workers%22%20when%3A7d&hl=en-IN&gl=IN&ceid=IN%3Aen') },
  { lang: 'en', key: 'up_migrants', url: q('%22Uttar+Pradesh%22+OR+%22UP%22+AND+%22migrant+workers%22%20when%3A7d&hl=en-IN&gl=IN&ceid=IN%3Aen') },
  { lang: 'en', key: 'tamil_nadu_migrants', url: q('%22Tamil+Nadu%22+AND+%28%22migrant+workers%22+OR+Singapore+OR+Malaysia+OR+Gulf%29%20when%3A7d&hl=en-IN&gl=IN&ceid=IN%3Aen') },
  { lang: 'hi', key: 'pravasi', url: q('प्रवासी%20when%3A7d&hl=hi&gl=IN&ceid=IN%3Ahi') },
  { lang: 'hi', key: 'pravasi_mazdoor', url: q('%22प्रवासी+मजदूर%22%20when%3A7d&hl=hi&gl=IN&ceid=IN%3Ahi') },
  { lang: 'ar', key: 'al_umal_al_muhajirin', url: q('%22العمال+المهاجرين%22%20when%3A7d&hl=ar&gl=AE&ceid=AE%3Aar') },
  { lang: 'ar', key: 'al_umalah_al_wafidah', url: q('%22العمالة+الوافدة%22%20when%3A7d&hl=ar&gl=AE&ceid=AE%3Aar') },
  { lang: 'tl', key: 'ofw_tagalog', url: q('OFW+OR+%22Overseas+Filipino+Worker%22+OR+%22manggagawang+migrante%22%20when%3A7d&hl=fil&gl=PH&ceid=PH%3Afil') },
  { lang: 'tl', key: 'dmw_owwa_ofw', url: q('%28DMW+OR+OWWA%29+AND+OFW%20when%3A7d&hl=fil&gl=PH&ceid=PH%3Afil') },
  { lang: 'te', key: 'pravasa_bharatiyulu', url: q('%22ప్రవాస+భారతీయులు%22%20when%3A7d&hl=te&gl=IN&ceid=IN%3Ate') },
  { lang: 'te', key: 'valasa_karmikulu', url: q('%22వలస+కార్మికులు%22%20when%3A7d&hl=te&gl=IN&ceid=IN%3Ate') },
]

export const SB_RELEVANT =
  'News about Indian migrant workers, or Indians working or stranded abroad, that S&B’s work touches: deaths, accidents, injuries or suicides of migrant workers; workers stranded, abandoned, trafficked, or stuck without wages, passports or exit permits; recruitment fraud and illegal agents; arrests, detentions and deportations; Gulf and other overseas labour conditions, kafala and wage theft; rescue and repatriation, embassy and ministry action; migration policy, emigration clearance and state schemes (NORKA, Telangana, Kerala, Bihar, Odisha); hardships of migrant workers inside India; labour law changes; court orders and reports on any of these.'

export const SB_IRRELEVANT =
  'Everything else: sports, entertainment, general politics, business and stock news, holiday travel and tourist visas, NRI success stories, investment and real estate, and news about the migration of other nationalities (for example the Philippines) unless Indian workers are involved.'

export const SB_LEVELS = [
  { name: 'minor', weight: 1, description: 'Only touches the subject: an opinion piece, a passing mention, background, or an old story told again.' },
  { name: 'notable', weight: 2, description: 'A useful report, study, statement or feature about the conditions of migrant workers, with no new incident behind it.' },
  { name: 'major', weight: 3, description: 'A significant new incident or development: a fraud racket busted, a repatriation operation, a new advisory, scheme or rule, or workers named and in difficulty.' },
  { name: 'critical', weight: 4, description: 'Deaths, a disaster, many workers stranded, detained or deported, a court order, or a ban or policy change that affects many Indian workers at once.' },
]
