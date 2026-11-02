import re
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import HTTPException, status

from app.core.config import settings
from app.core.supabase import get_tenant_supabase_client
from app.schemas.tenant_schemas import (
    RestaurantCreate, RestaurantResponse,
    BranchCreate, BranchResponse,
    MemberInvite, MemberResponse,
    RestaurantSettingsResponse, RestaurantSettingsUpdate
)

ROLE_RANKS = {
    "owner": 3,
    "admin": 2,
    "analyst": 1
}

def has_sufficient_role(user_role: str, required_role: str) -> bool:
    """Evaluates role hierarchy: owner > admin > analyst."""
    user_rank = ROLE_RANKS.get(user_role.lower(), 0)
    required_rank = ROLE_RANKS.get(required_role.lower(), 0)
    return user_rank >= required_rank


class TenantService:
    """
    Manages multi-tenant organizations, branches, and memberships.
    In production (settings.allow_in_memory_fallback == False), all operations execute
    strictly against Supabase PostgreSQL with verified RLS enforcement.
    In test / development configuration, in-memory stores support isolated unit tests.
    """
    def __init__(self):
        # In-memory store for offline tests and fast resolution
        self._restaurants: Dict[str, Dict[str, Any]] = {}
        self._memberships: Dict[str, List[Dict[str, Any]]] = {} # restaurant_id -> list of memberships
        self._branches: Dict[str, List[Dict[str, Any]]] = {}    # restaurant_id -> list of branches
        self._settings: Dict[str, Dict[str, Any]] = {}          # restaurant_id -> settings dict
        self._users: Dict[str, Dict[str, Any]] = {}             # user_id -> profile dict

    def _slugify(self, text: str) -> str:
        s = re.sub(r"[^\w\s-]", "", text).strip().lower()
        slug = re.sub(r"[-\s]+", "-", s)
        unique_suffix = uuid.uuid4().hex[:6]
        return f"{slug}-{unique_suffix}"

    def register_user_profile(self, user_id: str, email: str, full_name: Optional[str] = None):
        self._users[user_id] = {
            "id": user_id,
            "email": email,
            "full_name": full_name or email.split("@")[0],
            "created_at": datetime.now(timezone.utc).isoformat()
        }

    def get_user_profile(self, user_id: str) -> Optional[Dict[str, Any]]:
        return self._users.get(user_id)

    def create_restaurant(self, user_id: str, user_email: str, data: RestaurantCreate, user_jwt: Optional[str] = None) -> RestaurantResponse:
        self.register_user_profile(user_id, user_email)
        restaurant_id = str(uuid.uuid4())
        slug = self._slugify(data.name)
        now_str = datetime.now(timezone.utc).isoformat()

        rest_record = {
            "id": restaurant_id,
            "name": data.name,
            "slug": slug,
            "currency": data.currency or "INR",
            "currency_symbol": "₹" if (data.currency or "INR").upper() == "INR" else "$",
            "timezone": data.timezone or "Asia/Kolkata",
            "operational_model": data.operational_model or "dine_in_and_delivery",
            "created_at": now_str,
            "updated_at": now_str
        }

        # Creator automatically becomes 'owner' in restaurant_memberships
        membership_id = str(uuid.uuid4())
        owner_membership = {
            "id": membership_id,
            "restaurant_id": restaurant_id,
            "user_id": user_id,
            "role": "owner",
            "created_at": now_str
        }

        # Create default primary branch
        branch_id = str(uuid.uuid4())
        default_branch = {
            "id": branch_id,
            "restaurant_id": restaurant_id,
            "branch_code": "MAIN",
            "branch_name": f"{data.name} - Primary Outlet",
            "city": "Bengaluru",
            "state": "Karnataka",
            "is_active": True,
            "is_primary": True,
            "operating_days": "mon,tue,wed,thu,fri,sat,sun",
            "created_at": now_str
        }

        # Create default operational settings
        default_settings = {
            "restaurant_id": restaurant_id,
            "default_prep_buffer": 10,
            "default_forecasting_frequency": "daily",
            "auto_forecast_on_upload": True,
            "timezone": data.timezone or "Asia/Kolkata",
            "updated_at": now_str
        }

        # Primary live Supabase write
        if settings.SUPABASE_URL and settings.SUPABASE_KEY and user_jwt:
            try:
                client = get_tenant_supabase_client(user_jwt)
                client.table("restaurants").insert(rest_record).execute()
                client.table("restaurant_memberships").insert(owner_membership).execute()
                client.table("restaurant_branches").insert(default_branch).execute()
                client.table("restaurant_settings").insert(default_settings).execute()
            except Exception as e:
                if not settings.allow_in_memory_fallback:
                    raise HTTPException(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        detail=f"Database write failed: {e}"
                    )
                print(f"[TenantService] Note: Supabase write failed ({e}); local store active.")
        elif not settings.allow_in_memory_fallback:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Supabase credentials and user authentication token required in production."
            )

        # In-memory store for fast local resolution in dev/test
        self._restaurants[restaurant_id] = rest_record
        self._memberships[restaurant_id] = [owner_membership]
        self._branches[restaurant_id] = [default_branch]
        self._settings[restaurant_id] = default_settings

        return RestaurantResponse(
            id=restaurant_id,
            name=rest_record["name"],
            slug=rest_record["slug"],
            currency=rest_record["currency"],
            currency_symbol=rest_record["currency_symbol"],
            timezone=rest_record["timezone"],
            operational_model=rest_record["operational_model"],
            user_role="owner",
            created_at=now_str
        )

    def list_user_restaurants(self, user_id: str, user_jwt: Optional[str] = None) -> List[RestaurantResponse]:
        results = []

        # If in production, query Supabase directly under user's JWT
        if not settings.allow_in_memory_fallback:
            if not user_jwt:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication token required.")
            try:
                client = get_tenant_supabase_client(user_jwt)
                res = client.table("restaurants").select("*, restaurant_memberships(role)").execute()
                for row in res.data or []:
                    memberships = row.get("restaurant_memberships") or []
                    role = memberships[0]["role"] if memberships else "analyst"
                    results.append(RestaurantResponse(
                        id=row["id"],
                        name=row["name"],
                        slug=row["slug"],
                        currency=row.get("currency", "INR"),
                        currency_symbol=row.get("currency_symbol", "₹"),
                        timezone=row.get("timezone", "Asia/Kolkata"),
                        operational_model=row.get("operational_model", "dine_in_and_delivery"),
                        user_role=role,
                        created_at=row.get("created_at")
                    ))
                return results
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"Database query error: {e}"
                )

        # In test / development mode: check in-memory store first
        for rest_id, members in self._memberships.items():
            for m in members:
                if m["user_id"] == user_id:
                    rest = self._restaurants.get(rest_id)
                    if rest:
                        results.append(RestaurantResponse(
                            id=rest["id"],
                            name=rest["name"],
                            slug=rest["slug"],
                            currency=rest["currency"],
                            currency_symbol=rest["currency_symbol"],
                            timezone=rest["timezone"],
                            operational_model=rest["operational_model"],
                            user_role=m["role"],
                            created_at=rest["created_at"]
                        ))

        # Supabase fallback in dev/test if local store is empty
        if not results and settings.SUPABASE_URL and settings.SUPABASE_KEY and user_jwt:
            try:
                client = get_tenant_supabase_client(user_jwt)
                res = client.table("restaurants").select("*, restaurant_memberships(role)").execute()
                for row in res.data or []:
                    memberships = row.get("restaurant_memberships") or []
                    role = memberships[0]["role"] if memberships else "analyst"
                    results.append(RestaurantResponse(
                        id=row["id"],
                        name=row["name"],
                        slug=row["slug"],
                        currency=row.get("currency", "INR"),
                        currency_symbol=row.get("currency_symbol", "₹"),
                        timezone=row.get("timezone", "Asia/Kolkata"),
                        operational_model=row.get("operational_model", "dine_in_and_delivery"),
                        user_role=role,
                        created_at=row.get("created_at")
                    ))
            except Exception as e:
                print(f"[TenantService] Supabase list error: {e}")

        return results

    def get_restaurant(self, restaurant_id: str, user_id: str, user_jwt: Optional[str] = None) -> Optional[RestaurantResponse]:
        members = self._memberships.get(restaurant_id, [])
        user_role = next((m["role"] for m in members if m["user_id"] == user_id), None)

        if not user_role and user_jwt and settings.SUPABASE_URL and settings.SUPABASE_KEY:
            try:
                client = get_tenant_supabase_client(user_jwt)
                m_res = client.table("restaurant_memberships").select("role").eq("restaurant_id", restaurant_id).eq("user_id", user_id).execute()
                if m_res.data:
                    user_role = m_res.data[0]["role"]
            except Exception as e:
                if not settings.allow_in_memory_fallback:
                    raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Database query error: {e}")

        if not user_role:
            return None

        rest = self._restaurants.get(restaurant_id)
        if not rest and user_jwt and settings.SUPABASE_URL and settings.SUPABASE_KEY:
            try:
                client = get_tenant_supabase_client(user_jwt)
                r_res = client.table("restaurants").select("*").eq("id", restaurant_id).single().execute()
                if r_res.data:
                    rest = r_res.data
            except Exception as e:
                if not settings.allow_in_memory_fallback:
                    raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Database query error: {e}")

        if not rest:
            return None

        return RestaurantResponse(
            id=rest["id"],
            name=rest["name"],
            slug=rest["slug"],
            currency=rest.get("currency", "INR"),
            currency_symbol=rest.get("currency_symbol", "₹"),
            timezone=rest.get("timezone", "Asia/Kolkata"),
            operational_model=rest.get("operational_model", "dine_in_and_delivery"),
            user_role=user_role,
            created_at=rest.get("created_at")
        )

    def resolve_user_membership(self, restaurant_id: str, user_id: str, user_jwt: Optional[str] = None) -> Optional[str]:
        """
        Returns the user's role ('owner', 'admin', 'analyst') from restaurant_memberships or None.
        """
        # First check local cache in test/development
        members = self._memberships.get(restaurant_id, [])
        for m in members:
            if m["user_id"] == user_id:
                return m["role"]

        # Check Supabase restaurant_memberships under verified user JWT
        if settings.SUPABASE_URL and settings.SUPABASE_KEY and user_jwt:
            try:
                client = get_tenant_supabase_client(user_jwt)
                res = client.table("restaurant_memberships").select("role").eq("restaurant_id", restaurant_id).eq("user_id", user_id).execute()
                if res.data:
                    role = res.data[0]["role"]
                    # Cache in local state
                    self._memberships.setdefault(restaurant_id, []).append({
                        "id": str(uuid.uuid4()),
                        "restaurant_id": restaurant_id,
                        "user_id": user_id,
                        "role": role,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    })
                    return role
            except Exception as e:
                print(f"[TenantService] resolve_user_membership error: {e}")
                if not settings.allow_in_memory_fallback:
                    raise HTTPException(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        detail=f"Database error resolving user membership: {e}"
                    )

        return None

    def list_branches(self, restaurant_id: str, user_jwt: Optional[str] = None) -> List[BranchResponse]:
        if not settings.allow_in_memory_fallback:
            if not user_jwt:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication token required.")
            try:
                client = get_tenant_supabase_client(user_jwt)
                res = client.table("restaurant_branches").select("*").eq("restaurant_id", restaurant_id).execute()
                return [BranchResponse(**b) for b in (res.data or [])]
            except Exception as e:
                raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Database query error: {e}")

        branches = self._branches.get(restaurant_id, [])
        return [BranchResponse(**b) for b in branches]

    def create_branch(self, restaurant_id: str, data: BranchCreate, user_jwt: Optional[str] = None) -> BranchResponse:
        branches = self._branches.setdefault(restaurant_id, [])
        if any(b["branch_code"].upper() == data.branch_code.upper() for b in branches):
            raise ValueError(f"Branch code '{data.branch_code}' already exists in this restaurant.")

        branch_id = str(uuid.uuid4())
        now_str = datetime.now(timezone.utc).isoformat()
        new_branch = {
            "id": branch_id,
            "restaurant_id": restaurant_id,
            "branch_code": data.branch_code.upper(),
            "branch_name": data.branch_name,
            "city": data.city,
            "state": data.state,
            "is_active": True,
            "is_primary": data.is_primary,
            "operating_days": getattr(data, "operating_days", None) or "mon,tue,wed,thu,fri,sat,sun",
            "created_at": now_str
        }

        if settings.SUPABASE_URL and settings.SUPABASE_KEY and user_jwt:
            try:
                client = get_tenant_supabase_client(user_jwt)
                if data.is_primary:
                    client.table("restaurant_branches").update({"is_primary": False}).eq("restaurant_id", restaurant_id).execute()
                client.table("restaurant_branches").insert(new_branch).execute()
            except Exception as e:
                if not settings.allow_in_memory_fallback:
                    raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Database write error: {e}")
                print(f"[TenantService] Note: Supabase branch insert failed ({e}); local store active.")
        elif not settings.allow_in_memory_fallback:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database connection required in production.")

        if data.is_primary:
            for b in branches:
                b["is_primary"] = False
        branches.append(new_branch)
        return BranchResponse(**new_branch)

    def list_members(self, restaurant_id: str, user_jwt: Optional[str] = None) -> List[MemberResponse]:
        if settings.SUPABASE_URL and settings.SUPABASE_KEY and user_jwt:
            try:
                client = get_tenant_supabase_client(user_jwt)
                # Query established restaurant_memberships and profiles tables
                res = client.table("restaurant_memberships").select("id, restaurant_id, user_id, role, created_at, profiles(email, full_name)").eq("restaurant_id", restaurant_id).execute()
                output = []
                for m in (res.data or []):
                    prof = m.get("profiles") or {}
                    output.append(MemberResponse(
                        id=m["id"],
                        restaurant_id=restaurant_id,
                        user_id=m["user_id"],
                        email=prof.get("email"),
                        full_name=prof.get("full_name"),
                        role=m["role"],
                        created_at=m.get("created_at")
                    ))
                return output
            except Exception as e:
                if not settings.allow_in_memory_fallback:
                    raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Database query error: {e}")
                print(f"[TenantService] Supabase list_members note: {e}")

        # In-memory fallback in dev/test
        members = self._memberships.get(restaurant_id, [])
        output = []
        for m in members:
            user_profile = self._users.get(m["user_id"], {})
            output.append(MemberResponse(
                id=m["id"],
                restaurant_id=restaurant_id,
                user_id=m["user_id"],
                email=user_profile.get("email"),
                full_name=user_profile.get("full_name"),
                role=m["role"],
                created_at=m.get("created_at")
            ))
        return output

    def add_member(self, restaurant_id: str, invite: MemberInvite, actor_id: str, user_jwt: Optional[str] = None) -> MemberResponse:
        actor_role = self.resolve_user_membership(restaurant_id, actor_id, user_jwt=user_jwt)
        if not actor_role or not has_sufficient_role(actor_role, "admin"):
            raise PermissionError("Only admins or owners can add members.")

        if invite.role.lower() == "owner" and actor_role != "owner":
            raise PermissionError("Only current owners can grant owner privileges.")

        # Find existing profile
        invited_user_id = None
        user_full_name = invite.email.split("@")[0]

        if settings.SUPABASE_URL and settings.SUPABASE_KEY and user_jwt:
            try:
                client = get_tenant_supabase_client(user_jwt)
                p_res = client.table("profiles").select("id, email, full_name").eq("email", invite.email.lower()).execute()
                if p_res.data:
                    invited_user_id = p_res.data[0]["id"]
                    user_full_name = p_res.data[0].get("full_name") or user_full_name
            except Exception:
                pass

        if not invited_user_id:
            existing_user = next((u for u in self._users.values() if u.get("email") == invite.email.lower()), None)
            if existing_user:
                invited_user_id = existing_user["id"]
            else:
                invited_user_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, invite.email.lower()))
                self.register_user_profile(invited_user_id, invite.email.lower())

        members = self._memberships.setdefault(restaurant_id, [])
        if any(m["user_id"] == invited_user_id for m in members):
            raise ValueError(f"User with email '{invite.email}' is already a member.")

        membership_id = str(uuid.uuid4())
        now_str = datetime.now(timezone.utc).isoformat()
        new_membership = {
            "id": membership_id,
            "restaurant_id": restaurant_id,
            "user_id": invited_user_id,
            "role": invite.role.lower(),
            "created_at": now_str
        }

        if settings.SUPABASE_URL and settings.SUPABASE_KEY and user_jwt:
            try:
                client = get_tenant_supabase_client(user_jwt)
                client.table("restaurant_memberships").insert(new_membership).execute()
            except Exception as e:
                if not settings.allow_in_memory_fallback:
                    raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Database write error: {e}")
                print(f"[TenantService] Note: Supabase membership insert failed ({e}); local store active.")
        elif not settings.allow_in_memory_fallback:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database connection required in production.")

        members.append(new_membership)

        return MemberResponse(
            id=membership_id,
            restaurant_id=restaurant_id,
            user_id=invited_user_id,
            email=invite.email.lower(),
            full_name=user_full_name,
            role=invite.role.lower(),
            created_at=now_str
        )

    def remove_member(self, restaurant_id: str, membership_id: str, actor_id: str, user_jwt: Optional[str] = None):
        actor_role = self.resolve_user_membership(restaurant_id, actor_id, user_jwt=user_jwt)
        if not actor_role or not has_sufficient_role(actor_role, "admin"):
            raise PermissionError("Only admins or owners can remove members.")

        members = self._memberships.get(restaurant_id, [])
        target = next((m for m in members if m["id"] == membership_id), None)

        if not target and user_jwt and settings.SUPABASE_URL and settings.SUPABASE_KEY:
            try:
                client = get_tenant_supabase_client(user_jwt)
                m_res = client.table("restaurant_memberships").select("*").eq("id", membership_id).single().execute()
                if m_res.data:
                    target = m_res.data
            except Exception:
                pass

        if not target:
            raise KeyError("Membership not found.")

        if target["role"] == "owner" and actor_role != "owner":
            raise PermissionError("Admins cannot remove restaurant owners.")

        # Prevent removing the sole owner
        if target["role"] == "owner":
            owner_count = sum(1 for m in members if m["role"] == "owner")
            if owner_count <= 1:
                raise ValueError("Cannot remove the only owner of a restaurant.")

        if settings.SUPABASE_URL and settings.SUPABASE_KEY and user_jwt:
            try:
                client = get_tenant_supabase_client(user_jwt)
                client.table("restaurant_memberships").delete().eq("id", membership_id).execute()
            except Exception as e:
                if not settings.allow_in_memory_fallback:
                    raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Database delete error: {e}")
                print(f"[TenantService] Note: Supabase membership delete failed ({e}); local store active.")
        elif not settings.allow_in_memory_fallback:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database connection required in production.")

        self._memberships[restaurant_id] = [m for m in members if m["id"] != membership_id]

    def get_settings(self, restaurant_id: str, user_jwt: Optional[str] = None) -> RestaurantSettingsResponse:
        if settings.SUPABASE_URL and settings.SUPABASE_KEY and user_jwt:
            try:
                client = get_tenant_supabase_client(user_jwt)
                res = client.table("restaurant_settings").select("*").eq("restaurant_id", restaurant_id).single().execute()
                if res.data:
                    return RestaurantSettingsResponse(**res.data)
            except Exception as e:
                if not settings.allow_in_memory_fallback:
                    raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Database query error: {e}")

        st = self._settings.get(restaurant_id, {
            "restaurant_id": restaurant_id,
            "default_prep_buffer": 10,
            "default_forecasting_frequency": "daily",
            "auto_forecast_on_upload": True
        })
        return RestaurantSettingsResponse(**st)

    def update_settings(self, restaurant_id: str, data: RestaurantSettingsUpdate, actor_id: str, user_jwt: Optional[str] = None) -> RestaurantSettingsResponse:
        actor_role = self.resolve_user_membership(restaurant_id, actor_id, user_jwt=user_jwt)
        if not actor_role or not has_sufficient_role(actor_role, "admin"):
            raise PermissionError("Only admins or owners can modify operational settings.")

        current = self._settings.setdefault(restaurant_id, {
            "restaurant_id": restaurant_id,
            "default_prep_buffer": 10,
            "default_forecasting_frequency": "daily",
            "auto_forecast_on_upload": True
        })
        if data.default_prep_buffer is not None:
            if data.default_prep_buffer not in (0, 10, 15, 20):
                raise ValueError("Buffer must be one of: 0, 10, 15, 20.")
            current["default_prep_buffer"] = data.default_prep_buffer
        if data.default_forecasting_frequency is not None:
            if data.default_forecasting_frequency not in ("daily", "weekly"):
                raise ValueError("Frequency must be 'daily' or 'weekly'.")
            current["default_forecasting_frequency"] = data.default_forecasting_frequency
        if data.auto_forecast_on_upload is not None:
            current["auto_forecast_on_upload"] = data.auto_forecast_on_upload

        current["updated_at"] = datetime.now(timezone.utc).isoformat()

        if settings.SUPABASE_URL and settings.SUPABASE_KEY and user_jwt:
            try:
                client = get_tenant_supabase_client(user_jwt)
                client.table("restaurant_settings").upsert(current).execute()
            except Exception as e:
                if not settings.allow_in_memory_fallback:
                    raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Database update error: {e}")
                print(f"[TenantService] Note: Supabase settings update failed ({e}); local store active.")
        elif not settings.allow_in_memory_fallback:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database connection required in production.")

        return RestaurantSettingsResponse(**current)

    def reset_for_testing(self):
        """Clears in-memory collections for test isolation."""
        self._restaurants.clear()
        self._memberships.clear()
        self._branches.clear()
        self._settings.clear()
        self._users.clear()

tenant_service = TenantService()
