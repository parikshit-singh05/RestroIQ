"""
RestroIQ 3.0 — Operations Endpoints (Phase 4)
Exposes tenant-isolated endpoints for:
- Analytics & Sales Trends
- Predictive Inventory Preparation & Safety Buffers
- Menu Intelligence & Lifecycle Tracking
- Multi-Branch Extended Management
- Restaurant Profile & Team RBAC Management
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.security import require_tenant_access
from app.schemas.tenant_schemas import TenantContext
from app.services.operations_service import operations_service
from app.services.tenant_service import tenant_service
from app.schemas.operations_schemas import (
    TenantAnalyticsResponse,
    TenantInventoryResponse,
    TenantMenuResponse,
    MenuItemDetail,
    MenuItemCreate,
    MenuItemUpdate,
    BranchDetailResponse,
    BranchUpdate,
    RestaurantProfileUpdate,
    MemberRoleUpdate
)

router = APIRouter(prefix="/tenant/restaurants", tags=["Tenant Operations & Intelligence"])


# ==============================================================================
# 1. ANALYTICS WORKSPACE
# ==============================================================================

@router.get("/{restaurant_id}/analytics", response_model=TenantAnalyticsResponse)
def get_restaurant_analytics(
    restaurant_id: str,
    branch_id: Optional[str] = Query(None, description="Optional branch ID filter"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    category: Optional[str] = Query(None, description="Category filter"),
    context: TenantContext = Depends(require_tenant_access("analyst"))
):
    """
    Computes restaurant sales, revenue trends, AOV, top/slow-moving items, and promotion performance
    strictly from genuine POS transaction records.
    """
    return operations_service.get_restaurant_analytics(
        restaurant_id=restaurant_id,
        branch_id=branch_id,
        start_date=start_date,
        end_date=end_date,
        category=category,
        user_jwt=context.raw_jwt
    )


# ==============================================================================
# 2. INVENTORY PREPARATION & SAFETY BUFFER PLANNING
# ==============================================================================

@router.get("/{restaurant_id}/inventory", response_model=TenantInventoryResponse)
def get_inventory_planning(
    restaurant_id: str,
    branch_id: Optional[str] = Query(None, description="Branch ID"),
    frequency: str = Query("daily", description="'daily' or 'weekly'"),
    search: Optional[str] = Query(None, description="Search item name or category"),
    category: Optional[str] = Query(None, description="Category filter"),
    context: TenantContext = Depends(require_tenant_access("analyst"))
):
    """
    Calculates upcoming kitchen preparation requirements from AI demand forecasts with
    mathematically non-decreasing safety buffer targets (0%, 10%, 15%, 20%).
    """
    return operations_service.get_inventory_planning(
        restaurant_id=restaurant_id,
        branch_id=branch_id,
        frequency=frequency,
        search=search,
        category=category,
        user_jwt=context.raw_jwt
    )


# ==============================================================================
# 3. MENU INTELLIGENCE & CATALOG MANAGEMENT
# ==============================================================================

@router.get("/{restaurant_id}/menu", response_model=TenantMenuResponse)
def get_menu_catalog(
    restaurant_id: str,
    category: Optional[str] = Query(None, description="Filter category"),
    search: Optional[str] = Query(None, description="Search item name or SKU"),
    context: TenantContext = Depends(require_tenant_access("analyst"))
):
    """
    Retrieves full menu item intelligence: sales volume, velocity rank, and latest forecast demand.
    """
    return operations_service.get_menu_catalog(
        restaurant_id=restaurant_id,
        category=category,
        search=search,
        user_jwt=context.raw_jwt
    )


@router.post("/{restaurant_id}/menu", response_model=MenuItemDetail, status_code=status.HTTP_201_CREATED)
def create_menu_item(
    restaurant_id: str,
    data: MenuItemCreate,
    context: TenantContext = Depends(require_tenant_access("admin"))
):
    """
    Registers a new dish or menu item in the catalog. Requires 'admin' or 'owner' role.
    """
    try:
        return operations_service.create_menu_item(
            restaurant_id=restaurant_id,
            data=data,
            user_jwt=context.raw_jwt
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.put("/{restaurant_id}/menu/{item_name}", response_model=MenuItemDetail)
def update_menu_item(
    restaurant_id: str,
    item_name: str,
    data: MenuItemUpdate,
    context: TenantContext = Depends(require_tenant_access("admin"))
):
    """
    Updates menu item metadata (category, SKU, introduced_date, discontinued_date).
    Requires 'admin' or 'owner' role.
    """
    try:
        return operations_service.update_menu_item(
            restaurant_id=restaurant_id,
            item_name=item_name,
            data=data,
            user_jwt=context.raw_jwt
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ==============================================================================
# 4. EXTENDED BRANCH MANAGEMENT
# ==============================================================================

@router.get("/{restaurant_id}/branches/metrics", response_model=List[BranchDetailResponse])
def list_branches_with_metrics(
    restaurant_id: str,
    context: TenantContext = Depends(require_tenant_access("analyst"))
):
    """
    Lists all branches with order volumes, revenue metrics, operating days, and closures count.
    """
    return operations_service.list_branches_with_metrics(
        restaurant_id=restaurant_id,
        user_jwt=context.raw_jwt
    )


@router.get("/{restaurant_id}/branches/{branch_id}/detail", response_model=BranchDetailResponse)
def get_branch_detail(
    restaurant_id: str,
    branch_id: str,
    context: TenantContext = Depends(require_tenant_access("analyst"))
):
    """
    Retrieves single branch detail with operational metrics.
    """
    try:
        return operations_service.get_branch_detail(
            restaurant_id=restaurant_id,
            branch_id=branch_id,
            user_jwt=context.raw_jwt
        )
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))


@router.put("/{restaurant_id}/branches/{branch_id}", response_model=BranchDetailResponse)
def update_branch(
    restaurant_id: str,
    branch_id: str,
    data: BranchUpdate,
    context: TenantContext = Depends(require_tenant_access("admin"))
):
    """
    Updates branch configuration, operating days, or primary status. Requires 'admin' or 'owner'.
    """
    try:
        return operations_service.update_branch(
            restaurant_id=restaurant_id,
            branch_id=branch_id,
            data=data,
            actor_id=context.user_id,
            user_jwt=context.raw_jwt
        )
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except PermissionError as pe:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(pe))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.delete("/{restaurant_id}/branches/{branch_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_branch(
    restaurant_id: str,
    branch_id: str,
    context: TenantContext = Depends(require_tenant_access("owner"))
):
    """
    Deletes a branch outlet. Only the restaurant owner can delete outlets.
    Cannot delete the primary outlet or the only outlet.
    """
    try:
        operations_service.delete_branch(
            restaurant_id=restaurant_id,
            branch_id=branch_id,
            actor_id=context.user_id,
            user_jwt=context.raw_jwt
        )
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except PermissionError as pe:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(pe))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


# ==============================================================================
# 5. RESTAURANT PROFILE & TEAM RBAC
# ==============================================================================

@router.get("/{restaurant_id}/profile", response_model=Dict[str, Any])
def get_restaurant_profile(
    restaurant_id: str,
    context: TenantContext = Depends(require_tenant_access("analyst"))
):
    """
    Fetches restaurant organization profile metadata.
    """
    rest = tenant_service._restaurants.get(restaurant_id)
    if not rest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurant not found.")
    return rest


@router.put("/{restaurant_id}/profile", response_model=Dict[str, Any])
def update_restaurant_profile(
    restaurant_id: str,
    data: RestaurantProfileUpdate,
    context: TenantContext = Depends(require_tenant_access("admin"))
):
    """
    Updates restaurant profile metadata (name, currency, timezone, operational_model).
    Requires 'admin' or 'owner'.
    """
    try:
        return operations_service.update_restaurant_profile(
            restaurant_id=restaurant_id,
            data=data,
            actor_id=context.user_id,
            user_jwt=context.raw_jwt
        )
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except PermissionError as pe:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(pe))


@router.put("/{restaurant_id}/members/{membership_id}/role", response_model=Dict[str, Any])
def update_member_role(
    restaurant_id: str,
    membership_id: str,
    data: MemberRoleUpdate,
    context: TenantContext = Depends(require_tenant_access("admin"))
):
    """
    Updates the role of a restaurant team member ('owner', 'admin', 'analyst').
    Prevents demoting or removing the only owner of the restaurant.
    """
    try:
        return operations_service.update_member_role(
            restaurant_id=restaurant_id,
            membership_id=membership_id,
            new_role=data.role,
            actor_id=context.user_id,
            user_jwt=context.raw_jwt
        )
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except PermissionError as pe:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(pe))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))

