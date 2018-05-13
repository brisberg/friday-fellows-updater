export declare class Chinmei {
    costructor(username: string, password: string);

    verifyAuth(): Promise<Response>;
}

declare namespace Chimei {
    export interface UserModel {
        id: string,
        username: string,
    }

    export interface AnimeModel {
        id: number;
        episodes: number;
        status: number|string;
        score: number;
        storage_type: number;
        storage_value: number;
        times_rewatched: number;
        date_start: string;
        date_finish: string;
        priority: number;
        enable_discussion: number;
        enable_rewatching: number;
        comments: string;
        tags: string;
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
}
