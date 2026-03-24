export type TeamId = "team1" | "team2";
export type HistoryWinner = TeamId | "draw" | "";
export type BanOrder = "A_FIRST" | "B_FIRST" | "";
export type MapMode = "control" | "hybrid" | "flashpoint" | "push" | "escort" | "";

export interface BreakPlayer {
  name: string;
  position: string;
  mainHero: string;
  tier: string;
}

export interface BreakContentItem {
  id: string;
  title: string;
  type: "image" | "youtube";
  url: string;
  durationSeconds: number;
  enabled: boolean;
  order: number;
}

export interface EtcSettings {
  sponsor: string;
  breakContentType: "image" | "youtube";
  breakContentUrl: string;
  breakContents: BreakContentItem[];
  selectedBreakContentId: string;
  revision: number;
  rotationSeed: number;
  breakMinutes: number;
  breakSeconds: number;
  players: {
    team1: BreakPlayer[];
    team2: BreakPlayer[];
  };
}

export interface Settings {
  matchName: string;
  matchLogo: string;
  series: string;
  firstPickTeamId: TeamId;
  enableHeroBan: boolean;
  enableMapPick: boolean;
  etc: EtcSettings;
  mapPool: Record<Exclude<MapMode, "">, string[]>;
}

export interface TeamInfo {
  id: TeamId;
  name: string;
  color: string;
  logo: string;
}

export interface Teams {
  team1: TeamInfo;
  team2: TeamInfo;
}

export interface MatchState {
  currentMatchIndex: number;
  currentMapId: string;
  currentMapName: string;
  currentMapMode: MapMode;
  side: "attack" | "defense" | "";
  sidePickOwner: TeamId | "";
  sidePickReason: string;
  attackTeam: TeamId | "";
  overlayTeamSwap: boolean;
  overlayRoleSwap: boolean;
  layoutSwap: boolean;
  layoutSwapAuto: boolean;
  banChoiceOwnerAuto: TeamId | "";
  banChoiceOwnerManual: TeamId | "";
  banChoiceOwner: TeamId | "";
  banChoiceOwnerReason: string;
  banOrderAuto: BanOrder;
  banOrderManual: BanOrder;
  banOrder: BanOrder;
  bans: { team1: string; team2: string };
  firstBanTeamId: string;
  lastWinnerTeamId: string;
}

export interface HistoryEntry {
  index?: number;
  mapId?: string;
  mapMode?: string;
  winner?: HistoryWinner;
  bans?: { team1?: string; team2?: string };
}

export interface StoreData {
  settings: Settings;
  teams: Teams;
  state: MatchState;
  history: HistoryEntry[];
}

export interface OverlaySnapshot extends StoreData {
  score: { team1: number; team2: number };
  selectableMapIds: string[];
  assets: {
    maps: Array<Record<string, unknown>>;
    heroes: Array<Record<string, unknown>>;
  };
}

export interface AdminPublishPayload {
  settings?: Partial<Settings>;
  teams?: Teams;
  state?: MatchState;
  history?: HistoryEntry[];
  context?: string;
  reset?: boolean;
  skipHeroBan?: boolean;
  skipMapPick?: boolean;
  gameIndex?: number;
}
