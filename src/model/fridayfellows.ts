/**
 * Set of type definitions for FridayFellows domain models. These will be used
 * internally and act as the common storage medium between the different service
 * models.
 */

export enum Season {
  Spring = 0,
  Summer,
  Fall,
  Winter,
}

export interface SeasonModel {
  formattedName: string; // ex. 'Winter 2014'
  year: number;
  season: Season;
  startDate: Date;
  records: SeriesVotingRecord[];
}

// Current voting status of a show
export enum VotingStatus {
  Watching = 0,
  Dropped,
  Completed,
  Continuing,
}

export interface SeriesVotingRecord {
  series: AnimeModel;
  status: VotingStatus;
  startedWeek: number;
  completedWeek?: number;
}

export enum SeriesType {
  Series,
  Short,
}

export interface AnimeModel {
  titleEn: string;
  type: SeriesType;
  idMal?: number;
  idAL?: number;
  episodes: number;
  season: Season;
  year: number;
}

/// Export to List Service models
export enum WatchStatus {
  Watching = 0,
  Dropped,
  Completed,
}

export interface AnimeListRecord {
  series: AnimeModel;
  status: WatchStatus;
  startDate: Date;
  completedDate?: Date;
  tags: string[];
  score?: number;
  progress: number;
}
