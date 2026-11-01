from typing import Optional, Dict, Any, Callable
from fastapi import Header, HTTPException, Depends, Path, status
from app.core.supabase import decode_and_verify_jwt
from app.services.tenant_service import tenant_service, has_sufficient_role
from app.schemas.tenant_schemas import TenantContext

async def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """
    FastAPI dependency: Extracts and verifies Supabase JWT.
    Returns authenticated user context.
    Raises HTTP 401 Unauthorized if invalid, expired, or missing.
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header with Bearer token.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization scheme. Must be 'Bearer <token>'.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token = authorization[7:].strip()
    try:
        payload = decode_and_verify_jwt(token)
        user_id = payload.get("sub")
        email = payload.get("email", "")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token does not contain a valid user identifier ('sub')."
            )
        return {
            "id": user_id,
            "email": email,
            "raw_jwt": token,
            "claims": payload
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"}
        )


def require_tenant_access(required_role: str = "analyst") -> Callable:
    """
    FastAPI dependency factory:
    Enforces strict tenant isolation and role permissions.
    Resolves the authenticated user's actual database membership.
    
    NEVER trusts a browser-supplied restaurant_id without backend membership verification.
    """
    async def tenant_authorizer(
        restaurant_id: str = Path(..., description="Target restaurant UUID"),
        current_user: Dict[str, Any] = Depends(get_current_user)
    ) -> TenantContext:
        user_id = current_user["id"]
        user_email = current_user["email"]

        # Resolve verified membership
        user_role = tenant_service.resolve_user_membership(restaurant_id, user_id)
        if not user_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: You are not an authorized member of restaurant '{restaurant_id}'."
            )

        # Enforce role hierarchy: owner > admin > analyst
        if not has_sufficient_role(user_role, required_role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions: Role '{user_role}' cannot perform operations requiring '{required_role}'."
            )

        return TenantContext(
            user_id=user_id,
            email=user_email,
            restaurant_id=restaurant_id,
            role=user_role
        )

    return tenant_authorizer
