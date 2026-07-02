import bcrypt from "bcryptjs";

// Deliberately its own file, separate from lib/auth.ts. middleware.ts
// imports from lib/auth.ts and runs on the Edge runtime; keeping
// password hashing out of that file means the Edge bundle never needs
// to include bcryptjs, even though bcryptjs happens to be pure JS with
// no native bindings. Smaller, cleaner bundle either way.
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
