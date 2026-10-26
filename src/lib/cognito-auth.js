import {createAuthClient} from "@categori/app-auth-client";
import {rememberInvitationReturn} from "./invitation-return.js";
import {cognitoAuthConfig} from "./auth-config.js";

const provider = `https://${cognitoAuthConfig.hostedUiDomain}`;
const client = createAuthClient({
  configuration: {
    clientId: cognitoAuthConfig.clientId,
    scopes: cognitoAuthConfig.scopes,
    authorizationEndpoint: `${provider}/oauth2/authorize`,
    tokenEndpoint: `${provider}/oauth2/token`,
    registrationEndpoint: `${provider}/signup`,
    passwordResetEndpoint: `${provider}/forgotPassword`,
    logoutEndpoint: `${provider}/logout`,
    redirectUri: cognitoAuthConfig.redirectUri,
    logoutUri: cognitoAuthConfig.logoutUri
  },
  storageKeys: {sessionKey: "esia.auth.session.v1", pkceKey: "esia.auth.pkce.v1"},
  resolveRedirectUri: () => isLocalhost() ? `${window.location.origin}/` : cognitoAuthConfig.redirectUri,
  resolveLogoutUri: () => isLocalhost() ? `${window.location.origin}/` : cognitoAuthConfig.logoutUri,
  beforeHostedFlow: moveToAuthOrigin,
  groupsClaim: "cognito:groups",
  logoutRedirectParameter: "logout_uri",
  displayNameFallback: "ESIA user"
});

function notifySessionChange() {
  if (typeof window?.dispatchEvent === "function") window.dispatchEvent(new window.Event("esia-auth-session-change"));
}

export async function loadAuthSession() {
  rememberInvitationReturn(window.location.href, sessionStorage);
  try {return await client.loadAuthSession();}
  finally {notifySessionChange();}
}

export const {beginSignIn, beginRegistration, beginPasswordReset, getStoredAuthSession} = client;

export function signOut(...args) {
  try {return client.signOut(...args);}
  finally {notifySessionChange();}
}

function moveToAuthOrigin(action) {
  const invitation = action === "sign-in" ? rememberInvitationReturn(window.location.href, sessionStorage) : null;
  if (isLocalhost()) return false;
  const target = new URL(cognitoAuthConfig.redirectUri);
  if (window.location.origin === target.origin && window.location.pathname === target.pathname) return false;
  target.searchParams.set("auth", action);
  if (invitation) {
    target.searchParams.set("invitation", invitation.invitation_id);
    target.hash = new URLSearchParams({invitation_token: invitation.token, invitation_revision: String(invitation.expected_revision)}).toString();
  }
  window.location.assign(target.toString());
  return true;
}

function isLocalhost() {
  return ["localhost", "127.0.0.1"].includes(window.location.hostname);
}
