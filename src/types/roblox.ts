export interface AuthState {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
}

export interface PublishResult {
  success: boolean;
  versionNumber?: number;
  gameUrl?: string;
  error?: string;
}

export interface GameSettings {
  name: string;
  description: string;
  maxPlayers: number;
  universeId?: string;
  placeId?: string;
}
