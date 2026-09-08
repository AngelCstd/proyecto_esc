export type PrincipalType =
  | 'agent_user'
  | 'traveler_user'
  | 'api_key'
  | 'service';

export interface Principal {
  type: PrincipalType;
  userId?: string;
  agentId?: string;
  travelerId?: string;
  credentialId?: string;
  roles: string[];
  scopes: string[];
}
