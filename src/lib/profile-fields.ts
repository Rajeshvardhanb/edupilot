/** Contact details a student or parent may ask the office to correct. */
export const PROFILE_FIELDS = { phone: "Phone number", address: "Address", guardianName: "Guardian's name", guardianPhone: "Guardian's phone", guardianEmail: "Guardian's email" } as const;
export type ProfileField = keyof typeof PROFILE_FIELDS;
