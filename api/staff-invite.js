const SUPABASE_URL = "https://wuizpkfueudglmgdsavu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1aXpwa2Z1ZXVkZ2xtZ2RzYXZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMTg4OTUsImV4cCI6MjA5NDc5NDg5NX0.p1-d04TxeQfa_sg6QfoL8eAD4A9DULCwaS3GEiUcqmk";

function send(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}

function sameOriginRequest(req) {
  const origin = String(req.headers.origin || "");
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "");
  if (!origin || !host) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function bearerToken(req) {
  const authorization = String(req.headers.authorization || "");
  return authorization.startsWith("Bearer ") ? authorization : "";
}

async function authenticatedUser(authorization) {
  if (!authorization) return null;
  const response = await fetch(SUPABASE_URL + "/auth/v1/user", {
    headers:{ apikey:SUPABASE_ANON_KEY, Authorization:authorization },
  });
  if (!response.ok) return null;
  return response.json();
}

async function userRpc(authorization, functionName, body) {
  const response = await fetch(SUPABASE_URL + "/rest/v1/rpc/" + functionName, {
    method:"POST",
    headers:{
      apikey:SUPABASE_ANON_KEY,
      Authorization:authorization,
      "Content-Type":"application/json",
    },
    body:JSON.stringify(body),
  });
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  return { ok:response.ok, status:response.status, data };
}

function rpcMessage(result) {
  return String(result?.data?.message || result?.data?.error_description || "");
}

function publicError(result) {
  const message = rpcMessage(result);
  if (message.includes("STAFF_INVITATION_EMAIL_ALREADY_REGISTERED")) return { status:409, code:"email_already_registered" };
  if (message.includes("STAFF_INVITATION_EMAIL_ALREADY_PENDING")) return { status:409, code:"invitation_already_pending" };
  if (message.includes("STAFF_INVITATION_NOT_AUTHORIZED")) return { status:403, code:"not_authorized" };
  if (message.includes("INVALID_INPUT")) return { status:400, code:"invalid_input" };
  return { status:503, code:"invitation_unavailable" };
}

async function inviteAuthUser(secretKey, invitation) {
  const response = await fetch(SUPABASE_URL + "/auth/v1/invite", {
    method:"POST",
    headers:{
      apikey:secretKey,
      Authorization:"Bearer " + secretKey,
      "Content-Type":"application/json",
    },
    body:JSON.stringify({
      email:invitation.normalized_email,
      data:{
        sonsuz_staff_invitation_id:invitation.id,
        display_name:invitation.display_name,
      },
    }),
  });
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  return { ok:response.ok, status:response.status, data };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    send(res, 405, { ok:false, code:"method_not_allowed" });
    return;
  }
  if (!sameOriginRequest(req)) {
    send(res, 403, { ok:false, code:"origin_rejected" });
    return;
  }

  const authorization = bearerToken(req);
  const user = await authenticatedUser(authorization);
  if (!user?.id) {
    send(res, 401, { ok:false, code:"authentication_required" });
    return;
  }

  let body = {};
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  } catch {
    send(res, 400, { ok:false, code:"invalid_json" });
    return;
  }

  const organizationId = String(body.organizationId || "");
  const operationId = String(body.operationId || "");
  const email = String(body.email || "").trim().toLowerCase();
  const displayName = String(body.displayName || "").trim();
  const appRole = String(body.appRole || "");
  if (!organizationId || !operationId || email.length > 320 || displayName.length > 120 || !["admin", "teacher"].includes(appRole)) {
    send(res, 400, { ok:false, code:"invalid_input" });
    return;
  }

  try {
    const prepared = await userRpc(authorization, "prepare_staff_invitation", {
      p_organization_id:organizationId,
      p_email:email,
      p_display_name:displayName,
      p_app_role:appRole,
      p_operation_id:operationId,
    });
    if (!prepared.ok || !prepared.data?.invitation?.id) {
      const error = publicError(prepared);
      send(res, error.status, { ok:false, code:error.code });
      return;
    }

    const invitation = prepared.data.invitation;
    if (invitation.actor_user_id !== user.id || invitation.organization_id !== organizationId) {
      send(res, 409, { ok:false, code:"invitation_identity_conflict" });
      return;
    }

    const resolved = await userRpc(authorization, "resolve_staff_invitation_user", {
      p_operation_id:operationId,
    });
    if (!resolved.ok) {
      const error = publicError(resolved);
      send(res, error.status, { ok:false, code:error.code });
      return;
    }

    let targetUserId = resolved.data?.found ? String(resolved.data.userId || "") : "";
    let emailSent = prepared.data.operationState === "prepared";
    if (!targetUserId) {
      const secretKey = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "");
      if (!secretKey) {
        send(res, 503, { ok:false, code:"server_secret_not_configured", operationId });
        return;
      }
      const invited = await inviteAuthUser(secretKey, invitation);
      targetUserId = String(invited.data?.id || invited.data?.user?.id || "");
      if (!invited.ok || !targetUserId) {
        const checkedAgain = await userRpc(authorization, "resolve_staff_invitation_user", {
          p_operation_id:operationId,
        });
        targetUserId = checkedAgain.ok && checkedAgain.data?.found ? String(checkedAgain.data.userId || "") : "";
        if (!targetUserId) {
          send(res, invited.status === 429 ? 429 : 503, { ok:false, code:invited.status === 429 ? "invite_rate_limited" : "invite_send_failed", operationId });
          return;
        }
      }
      emailSent = true;
    }

    const finalized = await userRpc(authorization, "finalize_staff_invitation", {
      p_operation_id:operationId,
      p_target_user_id:targetUserId,
    });
    const finalizeState = String(finalized.data?.operationState || "");
    const finalizedInvitation = finalized.data?.invitation || null;
    const exactCompletedInvitation = finalizedInvitation?.status === "sent"
      && finalizedInvitation?.operation_id === operationId
      && finalizedInvitation?.organization_id === organizationId
      && finalizedInvitation?.target_user_id === targetUserId;
    const finalizedNow = finalizeState === "sent"
      && finalized.data?.profileActive === false
      && exactCompletedInvitation;
    const reconciledExisting = finalizeState === "replayed"
      && exactCompletedInvitation;
    if (!finalized.ok || (!finalizedNow && !reconciledExisting)) {
      send(res, 503, { ok:false, code:"invite_sent_finalize_pending", operationId });
      return;
    }

    send(res, 200, {
      ok:true,
      operationId,
      invitationId:invitation.id,
      targetUserId,
      emailSent,
      profileActive:false,
    });
  } catch {
    send(res, 503, { ok:false, code:"invitation_unavailable", operationId });
  }
}
