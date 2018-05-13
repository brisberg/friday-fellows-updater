/* eslint-disable */

export declare class Chinmei {
  costructor(username: string, password: string);

  verifyAuth(): Promise<Response>;
  getMalUser(username: string, mangaOrAnime: number, filter: string):
      Promise<GetMalUserResponse>;
  searchSingleAnime(title: string): Promise<MalAnimeModel>;
  addAnime(payload: AnimeModel): Promise<Response>;
  updateAnime(payload: AnimeModel): Promise<Response>;
}

export interface UserModel {
  id: string, username: string,
}

export interface AnimeModel {
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
}

export interface MangaModel {
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

export interface GetMalUserResponse {
  myinfo: MalUserInfo, anime: [MalAnimeRecord],
}

export interface MalUserInfo {
  user_id: number;
  user_name: string;
  user_watching: number;
  user_completed: number;
  user_onhold: number;
  user_dropped: number;
  user_plantowatch: number;
  user_days_spent_watching: number;
}

export interface MalMyAnimeRecord {
  series_animedb_id: number;
  series_title: string;
  series_synonyms: string;
  series_episodes: number;
  series_status: number;
  series_start: string;
  series_end: string;
  series_image: string;
  my_id: number;
  my_watched_episodes: string;
  my_start_date: string;
  my_finish_date: string;
  my_score: string;
  my_status: string;
  my_rewatching_ep: number;
  my_last_updated: number;
  my_tags: string;
}

export interface MalAnimeModel {
  id: string;
  title: string;
  english: string;
  synonyms: string;
  episodes: number;
  score: string;
  type: string;
  status: string;
  start_date: string;
  end_date: string;
  image: string;
}
