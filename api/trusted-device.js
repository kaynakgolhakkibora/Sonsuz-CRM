import { createHash, randomBytes } from "node:crypto";
import { Buffer } from "node:buffer";

const SUPABASE_URL = "https://wuizpkfueudglmgdsavu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1aXpwa2Z1ZXVkZ2xtZ2RzYXZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMTg4OTUsImV4cCI6MjA5NDc5NDg5NX0.p1-d04TxeQfa_sg6QfoL8eAD4A9DULCwaS3GEiUcqmk";
const TRUST_COOKIE = "__Host-sonsuz_crm_trusted_device";
const TRUST_SECONDS = 60 * 60 * 24 * 30;

function send(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}

function cookieValue(req, name) {
  const header = String(req.headers.cookie || "");
  const prefix = name + "=";
  for (const part of header.split(";")) {
    const value = part.trim();
    if (value.startsWith(prefix)) return decodeURIComponent(value.slice(prefix.length));
  }
  return "";
}

function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

function setTrustCookie(res, token) {
  res.setHeader("Set-Cookie", `${TRUST_COOKIE}=${encodeURIComponent(token)}; Max-Age=${TRUST_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`);
}

function clearTrustCookie(res) {
  res.setHeader("Set-Cookie", `${TRUST_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`);
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

async function authenticatedUser(req) {
  const authorization = String(req.headers.authorization || "");
  if (!authorization.startsWith("Bearer ")) return null;
  const response = await fetch(SUPABASE_URL + "/auth/v1/user", {
    headers: { apikey:SUPABASE_ANON_KEY, Authorization:authorization },
  });
  if (!response.ok) return null;
  return response.json();
}

function jwtAal(authorization) {
  try {
    const token = authorization.slice("Bearer ".length);
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(payload, "base64").toString("utf8")).aal || "aal1";
  } catch {
    return "aal1";
  }
}

async function userRpc(authorization, functionName, body) {
  return fetch(SUPABASE_URL + "/rest/v1/rpc/" + functionName, {
    method:"POST",
    headers: {
      apikey:SUPABASE_ANON_KEY,
      Authorization:authorization,
      "Content-Type":"application/json",
    },
    body:JSON.stringify(body),
  });
}

async function findTrustedDevice(authorization, rawToken) {
  if (!rawToken || rawToken.length < 32) return null;
  const response = await userRpc(authorization, "check_trusted_device", {
    p_token_hash:tokenHash(rawToken),
  });
  if (!response.ok) throw new Error("trusted-device-query-failed");
  const rows = await response.json();
  return rows?.[0]?.trusted ? rows[0] : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    send(res, 405, { trusted:false });
    return;
  }
  if (!sameOriginRequest(req)) {
    send(res, 403, { trusted:false });
    return;
  }

  try {
    const user = await authenticatedUser(req);
    if (!user?.id) {
      send(res, 401, { trusted:false });
      return;
    }
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const action = body.action;
    const rawToken = cookieValue(req, TRUST_COOKIE);
    const authorization = String(req.headers.authorization || "");

    if (action === "check") {
      const device = await findTrustedDevice(authorization, rawToken);
      if (!device) {
        send(res, 200, { trusted:false });
        return;
      }
      send(res, 200, { trusted:true, expiresAt:device.expires_at || "" });
      return;
    }

    if (action === "issue") {
      if (jwtAal(String(req.headers.authorization || "")) !== "aal2") {
        send(res, 403, { trusted:false });
        return;
      }
      const token = randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + TRUST_SECONDS * 1000).toISOString();
      const response = await userRpc(authorization, "issue_trusted_device", {
        p_token_hash:tokenHash(token),
        p_expires_at:expiresAt,
      });
      if (!response.ok) throw new Error("trusted-device-create-failed");
      setTrustCookie(res, token);
      send(res, 200, { trusted:true, expiresAt });
      return;
    }

    if (action === "revoke") {
      if (rawToken) {
        const revokeResponse = await userRpc(authorization, "revoke_trusted_device", {
          p_token_hash:tokenHash(rawToken),
        });
        if (!revokeResponse.ok) throw new Error("trusted-device-revoke-failed");
      }
      clearTrustCookie(res);
      send(res, 200, { trusted:false });
      return;
    }

    send(res, 400, { trusted:false });
  } catch {
    send(res, 503, { trusted:false });
  }
}
