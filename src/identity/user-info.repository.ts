export interface UserInfoRecord {
  userId: string | null;
  agentId: string | null;
  travelerId: string | null;
  role: string | null;
}

export abstract class UserInfoRepository {
  abstract findByUserId(userId: string): Promise<UserInfoRecord | null>;
}
