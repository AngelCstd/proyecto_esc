import { Principal } from './principal';

export interface HumanPrincipalRequest {
  headers: {
    authorization?: string | string[];
  };
  principal?: Principal;
}
