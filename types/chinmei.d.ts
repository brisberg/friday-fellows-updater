
/* eslint-disable */
declare module 'chinmei' {
  export = Chinmei;

  function Chinmei(username: string, password: string): Chinmei.ChinmeiClient;
}

declare namespace Chinmei {
  export class ChinmeiClient {
    costructor(username: string, password: string): ChinmeiClient;

    verifyAuth(): Promise<Response>;
    getMalUser(username: string, mangaOrAnime: number, filter: string):
        Promise<GetMalUserResponse>;
    searchSingleAnime(title: string): Promise<MalAnimeModel>;
    addAnime(payload: AnimeModel): Promise<Response>;
    updateAnime(payload: AnimeModel): Promise<Response>;
  }

  enum WatchStatus {
    WATCHING = 1,
    COMPLETED = 2,
    ONHOLD = 3,
    DROPPED = 4,
    PLANTOWATCH = 6,
  }

  interface UserModel {
    id: string, username: string,
  }

  interface AnimeModel {
    id: number;
    episode?: number;
    status?: number|string;
    score?: number;
    storage_type?: number;
    storage_value?: number;
    times_rewatched?: number;
    date_start?: string;
    date_finish?: string;
    priority?: number;
    enable_discussion?: number;
    enable_rewatching?: number;
    comments?: string;
    tags?: string;
    // local modifications
    title?: string;
    new?: boolean;
  }

  interface MangaModel {
    id: number;
    chapter: number;
    volume: number;
    status: number|string;
    score: number;
    times_reread: number;
    reread_value: number;
    date_start: string;
    date_finish: string;
    priority: number;
    enable_discussion: number;
    enable_rewatching: number;
    comments: string;
    scan_group: string;
    tags: string;
    retail_volumes: number;
  }

  interface GetMalUserResponse {
    myinfo: MalUserInfo, anime: [MalMyAnimeRecord],
  }

  interface MalUserInfo {
    user_id: number;
    user_name: string;
    user_watching: number;
    user_completed: number;
    user_onhold: number;
    user_dropped: number;
    user_plantowatch: number;
    user_days_spent_watching: number;
  }

  interface MalMyAnimeRecord {
    series_animedb_id: string;
    series_title: string;
    series_synonyms: string;
    series_episodes: string;
    series_status: string;
    series_start: string;
    series_end: string;
    series_image: string;
    my_id: string;
    my_watched_episodes: string;
    my_start_date: string;
    my_finish_date: string;
    my_score: string;
    my_status: string;
    my_rewatching_ep: string;
    my_last_updated: string;
    my_tags: string;
    // local modification
    newAnime?: boolean;
  }

  interface MalAnimeModel {
    id: string;
    title: string;
    english: string;
    synonyms: string;
    episodes: string;
    score: string;
    type: string;
    status: string;
    start_date: string;
    end_date: string;
    image: string;
  }
}