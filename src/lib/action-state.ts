export type ActionState = {
  ok?: boolean;
  challengeId?: string;
  newEmailChallengeId?: string;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const initialState: ActionState = {};
