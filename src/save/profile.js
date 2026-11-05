// Agent B owns this file (stub). Replace with the real versioned save + migrations.
export async function loadProfile(state) {
  state.profile = { version: 1, coins: 0 };
}
