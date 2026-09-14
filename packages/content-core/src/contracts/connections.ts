/** Metadata for a delegated agent connection. All fields are strings; no hash or secret is exposed. */
export interface AgentConnection {
  id: string;
  draftId: 'current';
  principalUserId: string;
  label: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
}
