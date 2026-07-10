import { randomBytes } from "node:crypto";

// Unambiguous alphabet — no 0/O or 1/I/L — so a code read aloud or typed by
// hand doesn't produce silent mismatches.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

export function generateInviteCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}
