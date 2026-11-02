from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.security import get_current_user, require_tenant_access
from app.services.tenant_service import tenant_service
from app.schemas.tenant_schemas import (
    RestaurantCreate, RestaurantResponse,
    BranchCreate, BranchResponse,
    MemberInvite, MemberResponse,
    RestaurantSettingsResponse, RestaurantSettingsUpdate,
    TenantContext
)

router = APIRouter(prefix="/tenant", tags=["Tenant Management"])


@router.post("/restaurants", response_model=RestaurantResponse, status_code=status.HTTP_201_CREATED)
def create_restaurant(
    data: RestaurantCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Creates a new restaurant organization / workspace.
    The calling authenticated user is automatically assigned as 'owner'
    and a default primary outlet branch is provisioned.
    """
    try:
        return tenant_service.create_restaurant(
            user_id=current_user["id"],
            user_email=current_user["email"],
            data=data,
            user_jwt=current_user["raw_jwt"]
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/restaurants", response_model=List[RestaurantResponse])
def list_my_restaurants(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns only the restaurants where the authenticated user holds an active membership.
    Tenant isolation is strictly maintained.
    """
    return tenant_service.list_user_restaurants(
        user_id=current_user["id"],
        user_jwt=current_user["raw_jwt"]
    )


@router.get("/restaurants/{restaurant_id}", response_model=RestaurantResponse)
def get_restaurant_details(
    restaurant_id: str,
    context: TenantContext = Depends(require_tenant_access("analyst"))
):
    """
    Fetches restaurant metadata. Requires active membership.
    """
    res = tenant_service.get_restaurant(restaurant_id, context.user_id, user_jwt=context.raw_jwt)
    if not res:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurant not found.")
    return res


@router.get("/restaurants/{restaurant_id}/branches", response_model=List[BranchResponse])
def list_branches(
    restaurant_id: str,
    context: TenantContext = Depends(require_tenant_access("analyst"))
):
    """
    Lists all branches for the authorized restaurant.
    """
    return tenant_service.list_branches(restaurant_id, user_jwt=context.raw_jwt)


@router.post("/restaurants/{restaurant_id}/branches", response_model=BranchResponse, status_code=status.HTTP_201_CREATED)
def create_branch(
    restaurant_id: str,
    data: BranchCreate,
    context: TenantContext = Depends(require_tenant_access("admin"))
):
    """
    Adds a new branch outlet. Requires 'admin' or 'owner' role.
    """
    try:
        return tenant_service.create_branch(restaurant_id, data, user_jwt=context.raw_jwt)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/restaurants/{restaurant_id}/members", response_model=List[MemberResponse])
def list_members(
    restaurant_id: str,
    context: TenantContext = Depends(require_tenant_access("analyst"))
):
    """
    Lists members and their assigned roles in this restaurant.
    """
    return tenant_service.list_members(restaurant_id, user_jwt=context.raw_jwt)


@router.post("/restaurants/{restaurant_id}/members", response_model=MemberResponse, status_code=status.HTTP_201_CREATED)
def add_member(
    restaurant_id: str,
    invite: MemberInvite,
    context: TenantContext = Depends(require_tenant_access("admin"))
):
    """
    Invites a new member with role 'admin' or 'analyst'. Requires 'admin' or 'owner'.
    """
    try:
        return tenant_service.add_member(restaurant_id, invite, actor_id=context.user_id, user_jwt=context.raw_jwt)
    except PermissionError as pe:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(pe))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.delete("/restaurants/{restaurant_id}/members/{membership_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    restaurant_id: str,
    membership_id: str,
    context: TenantContext = Depends(require_tenant_access("admin"))
):
    """
    Removes a member from the restaurant. Requires 'admin' or 'owner'.
    """
    try:
        tenant_service.remove_member(restaurant_id, membership_id, actor_id=context.user_id, user_jwt=context.raw_jwt)
    except PermissionError as pe:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(pe))
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membership not found.")
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.get("/restaurants/{restaurant_id}/settings", response_model=RestaurantSettingsResponse)
def get_settings(
    restaurant_id: str,
    context: TenantContext = Depends(require_tenant_access("analyst"))
):
    """
    Retrieves operational preferences (prep buffer, frequency).
    """
    return tenant_service.get_settings(restaurant_id, user_jwt=context.raw_jwt)


@router.put("/restaurants/{restaurant_id}/settings", response_model=RestaurantSettingsResponse)
def update_settings(
    restaurant_id: str,
    data: RestaurantSettingsUpdate,
    context: TenantContext = Depends(require_tenant_access("admin"))
):
    """
    Updates operational preferences. Requires 'admin' or 'owner'.
    """
    try:
        return tenant_service.update_settings(restaurant_id, data, actor_id=context.user_id, user_jwt=context.raw_jwt)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except PermissionError as pe:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(pe))

