export interface TrustedHumanIdentity {
  userId: string;
}

export interface HumanIdentityVerifier {
  verifyAccessToken(
    accessToken: string | null | undefined,
  ): Promise<TrustedHumanIdentity>;
}

export const HUMAN_IDENTITY_VERIFIER = Symbol('HUMAN_IDENTITY_VERIFIER');
