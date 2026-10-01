export interface Account {
  id: string;
  name: string;
  username: string;
  passwordHash: string;
  salt: string;
  recoveryHash: string;
  recoverySalt: string;
  biometric: boolean;
  createdAt: string;
}

export type PublicAccount = Pick<Account, 'id' | 'name' | 'username' | 'biometric' | 'createdAt'>;

export interface AccountsFile {
  accounts: Account[];
  legacyClaimed: boolean;
}
