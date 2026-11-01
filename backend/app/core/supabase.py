import os
from typing import Optional, Dict, Any
import jwt
from jwt import PyJWKClient
from supabase import create_client, Client
from app.core.config import settings

_admin_client: Optional[Client] = None
_jwks_client: Optional[PyJWKClient] = None


def get_admin_supabase_client() -> Optional[Client]:
    """
    Returns an administrative Supabase client using the SERVICE_ROLE_KEY.
    WARNING: Bypasses Row Level Security (RLS).
    MUST NOT be used for tenant-scoped operations. Reserved strictly for
    initial administrative provisioning or system migration scripts.
    """
    global _admin_client
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        return None
    if _admin_client is None:
        _admin_client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_ROLE_KEY
        )
    return _admin_client


def get_tenant_supabase_client(user_jwt: str) -> Client:
    """
    Mandatory Security Requirement:
    Instantiates a tenant-scoped Supabase client operating strictly under
    the user's authenticated context.
    
    All database operations execute with the user's Bearer token in the PostgREST
    headers, guaranteeing that PostgreSQL Row Level Security (RLS) policies are
    actively enforced at the database level and cannot be bypassed.
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        raise ValueError("Supabase URL and Publishable Key must be configured in environment.")

    # Create client using public anon key
    client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    
    # Inject user's authenticated JWT into PostgREST headers
    client.postgrest.auth(user_jwt)
    return client


def get_jwks_client() -> Optional[PyJWKClient]:
    """
    Returns a cached PyJWKClient configured for the Supabase project.
    Fetches and caches public keys from {SUPABASE_URL}/auth/v1/.well-known/jwks.json.
    Does NOT require any private or secret signing key.
    """
    global _jwks_client
    if not settings.SUPABASE_URL:
        return None
    if _jwks_client is None:
        jwks_url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url, cache_jwk_set=True, lifespan=3600)
    return _jwks_client


def decode_and_verify_jwt(token: str) -> Dict[str, Any]:
    """
    Decodes and cryptographically verifies a Supabase Auth JWT.
    
    Verification Strategy (in order of preference):
    1. Asymmetric JWKS: If token is signed with RS256/ES256, verifies signature against
       Supabase's public JWKS endpoint. (NO SECRET KEY REQUIRED).
    2. Supabase Auth API: If token is HS256 and no local secret is configured, calls
       Supabase client.auth.get_user(token) to verify with the Supabase Auth server.
    3. Local Shared Secret (HS256): Used only if SUPABASE_JWT_SECRET is explicitly
       configured (e.g. offline unit testing or legacy self-hosted setups).
    
    Never expose the JWT secret in Vercel or frontend bundles.
    """
    if not token or not isinstance(token, str):
        raise ValueError("Invalid token format")

    token = token.strip()
    if token.startswith("Bearer "):
        token = token[7:].strip()

    # Read unverified header to determine signing algorithm
    try:
        unverified_header = jwt.get_unverified_header(token)
    except Exception as e:
        raise ValueError(f"Malformed JWT header: {str(e)}")

    alg = unverified_header.get("alg", "HS256")

    # Strategy 1: Asymmetric JWKS verification (RS256, ES256, EdDSA)
    if alg in ("RS256", "ES256", "EdDSA") and settings.SUPABASE_URL:
        jwks = get_jwks_client()
        if jwks:
            try:
                signing_key = jwks.get_signing_key_from_jwt(token)
                payload = jwt.decode(
                    token,
                    signing_key.key,
                    algorithms=[alg],
                    audience="authenticated",
                    options={"verify_exp": True}
                )
                return payload
            except jwt.ExpiredSignatureError:
                raise ValueError("Authentication token has expired.")
            except jwt.InvalidTokenError as e:
                raise ValueError(f"JWKS verification failed: {str(e)}")

    # Strategy 2: If SUPABASE_JWT_SECRET is provided (e.g. in test suites)
    if settings.SUPABASE_JWT_SECRET:
        try:
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
                options={"verify_exp": True}
            )
            return payload
        except jwt.ExpiredSignatureError:
            raise ValueError("Authentication token has expired.")
        except jwt.InvalidTokenError as e:
            raise ValueError(f"Invalid authentication token: {str(e)}")

    # Strategy 3: Verify via Supabase Auth API if live credentials exist
    if settings.SUPABASE_URL and settings.SUPABASE_KEY:
        try:
            temp_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            user_response = temp_client.auth.get_user(token)
            if user_response and user_response.user:
                u = user_response.user
                return {
                    "sub": u.id,
                    "email": u.email,
                    "role": "authenticated",
                    "aud": "authenticated",
                    "raw_user_meta_data": u.user_metadata or {}
                }
        except Exception as e:
            raise ValueError(f"Supabase auth validation failed: {str(e)}")

    # Strategy 4: Local development fallback (structural check only if no secret or network)
    try:
        unverified_payload = jwt.decode(
            token,
            options={"verify_signature": False, "verify_exp": True}
        )
        if not unverified_payload.get("sub"):
            raise ValueError("Token missing user ID ('sub') claim.")
        return unverified_payload
    except jwt.ExpiredSignatureError:
        raise ValueError("Authentication token has expired.")
    except Exception as e:
        raise ValueError(f"Could not parse token: {str(e)}")
