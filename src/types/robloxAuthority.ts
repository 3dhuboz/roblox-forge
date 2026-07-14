import type { OperationReceipt } from "./receipts";

export type RobloxCredentialPurpose = "publish" | "analytics";

export interface CredentialSlotStatus {
  readonly purpose: RobloxCredentialPurpose;
  readonly configured: boolean;
  readonly alias: string;
  readonly verifiedAt?: string;
}

export type RobloxCapabilityState =
  | "ready"
  | "setup_required"
  | "unsupported";

export interface CapabilityDetail {
  readonly state: RobloxCapabilityState;
  readonly ready: boolean;
  readonly requiredScopes: readonly string[];
  readonly reason: string;
}

export interface RobloxAuthorityCapabilities {
  readonly authMode: "api_key";
  readonly createUniverse: CapabilityDetail;
  readonly publishExistingPlace: CapabilityDetail;
  readonly updatePlaceMetadata: CapabilityDetail;
  readonly ownedAnalytics: CapabilityDetail;
}

export interface VerifiedRobloxTarget {
  readonly id: string;
  readonly label: string;
  readonly universeId: string;
  readonly rootPlaceId: string;
  readonly publishCredentialAlias: string;
  readonly analyticsCredentialAlias?: string;
  readonly verifiedAt: string;
  readonly gameUrl: string;
}

export interface RobloxAuthorityState {
  readonly publishCredential: CredentialSlotStatus;
  readonly analyticsCredential: CredentialSlotStatus;
  readonly targets: readonly VerifiedRobloxTarget[];
  readonly capabilities: RobloxAuthorityCapabilities;
  readonly createUniverseSupported: false;
}

export interface RegisterRobloxTargetInput {
  readonly label: string;
  readonly universeId: string;
  readonly rootPlaceId: string;
  readonly publishCredentialAlias: string;
  readonly analyticsCredentialAlias?: string;
}

export interface PublishRobloxProjectInput {
  readonly projectPath: string;
  readonly targetId: string;
  readonly name: string;
  readonly description: string;
}

export interface PublishReceiptValue {
  readonly targetId: string;
  readonly universeId: string;
  readonly rootPlaceId: string;
  readonly gameUrl: string;
  readonly uploadCompleted: boolean;
  readonly metadataCompleted: boolean;
  readonly versionNumber?: number;
}

export type CredentialMutationReceipt = OperationReceipt<CredentialSlotStatus>;
export type TargetRegistrationReceipt = OperationReceipt<VerifiedRobloxTarget>;
export type RobloxPublishReceipt = OperationReceipt<PublishReceiptValue>;
