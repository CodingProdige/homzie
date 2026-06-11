export type LibraryTrack = {
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
  coverUrl: string | null;
  durationSeconds: number;
  genre: string | null;
};

export type ExternalTrack = {
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
  coverUrl: string | null;
  durationSeconds: number;
  tags: string[];
};
