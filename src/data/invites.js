import { supabase } from "../supabase";

// Every invite is issued to an email. Sign-up is blocked in the database
// (handle_new_user) for any email that isn't on signup_allowlist, so an
// invite without an allowlisted email can never be used. The create_invite
// RPC mints the code AND writes the allowlist entry in one transaction,
// applying the same who-may-invite-whom rules as the invites policies.
export async function createInvite({ email, role, squadId }) {
  return supabase.rpc("create_invite", {
    p_email: (email || "").trim(),
    p_role: role,
    p_squad_id: squadId || null,
  });
}

// create_invite raises short machine codes; show them as readable text.
const INVITE_ERRORS = {
  invite_invalid_email: "ros.err_invite_email",
  invite_email_registered: "ros.err_invite_registered",
  invite_not_permitted: "ros.err_invite_not_permitted",
  invite_invalid_role: "ros.err_invite_not_permitted",
  invite_squad_required: "ros.err_select_squad",
};

export function inviteErrorText(error, t) {
  const msg = String(error?.message || error || "");
  for (const [code, key] of Object.entries(INVITE_ERRORS)) {
    if (msg.includes(code)) return t(key);
  }
  return msg;
}
