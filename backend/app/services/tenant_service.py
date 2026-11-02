import re
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from app.core.config import settings
from app.core.supabase import get_tenant_supabase_client, get_admin_supabase_client
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
    Supports both direct Supabase execution with RLS enforcement
    and an in-memory repository for offline unit/security tests.
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
        self._restaurants[restaurant_id] = rest_record

        # Creator automatically becomes 'owner'
        membership_id = str(uuid.uuid4())
        owner_membership = {
            "id": membership_id,
            "restaurant_id": restaurant_id,
            "user_id": user_id,
            "role": "owner",
            "created_at": now_str
        }
        self._memberships[restaurant_id] = [owner_membership]

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
            "created_at": now_str
        }
        self._branches[restaurant_id] = [default_branch]

        # Create default operational settings
        self._settings[restaurant_id] = {
            "restaurant_id": restaurant_id,
            "default_prep_buffer": 10,
            "default_forecasting_frequency": "daily",
            "auto_forecast_on_upload": True,
            "updated_at": now_str
        }

        # If live Supabase credentials configured and user_jwt present, replicate to Supabase
        if settings.SUPABASE_URL and settings.SUPABASE_KEY and user_jwt:
            try:
                client = get_tenant_supabase_client(user_jwt)
                client.table("restaurants").insert(rest_record).execute()
                client.table("restaurant_memberships").insert(owner_membership).execute()
                client.table("restaurant_branches").insert(default_branch).execute()
                client.table("restaurant_settings").insert(self._settings[restaurant_id]).execute()
            except Exception as e:
                # Log but do not block local state
                print(f"[TenantService] Note: Supabase write failed ({e}); local store active.")

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
        # First check in-memory store
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

        # Check Supabase if configured and user_jwt provided
        if not results and settings.SUPABASE_URL and settings.SUPABASE_KEY and user_jwt:
            try:
                client = get_tenant_supabase_client(user_jwt)
                # Queries execute under user's JWT, leveraging RLS
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

    def get_restaurant(self, restaurant_id: str, user_id: str) -> Optional[RestaurantResponse]:
        members = self._memberships.get(restaurant_id, [])
        user_role = next((m["role"] for m in members if m["user_id"] == user_id), None)
        if not user_role:
            return None
        rest = self._restaurants.get(restaurant_id)
        if not rest:
            return None
        return RestaurantResponse(
            id=rest["id"],
            name=rest["name"],
            slug=rest["slug"],
            currency=rest["currency"],
            currency_symbol=rest["currency_symbol"],
            timezone=rest["timezone"],
            operational_model=rest["operational_model"],
            user_role=user_role,
            created_at=rest["created_at"]
        )

    def resolve_user_membership(self, restaurant_id: str, user_id: str) -> Optional[str]:
        """Returns the user's role ('owner', 'admin', 'analyst') or None."""
        members = self._memberships.get(restaurant_id, [])
        for m in members:
            if m["user_id"] == user_id:
                return m["role"]
        return None

    def list_branches(self, restaurant_id: str) -> List[BranchResponse]:
        branches = self._branches.get(restaurant_id, [])
        return [BranchResponse(**b) for b in branches]

    def create_branch(self, restaurant_id: str, data: BranchCreate) -> BranchResponse:
        branches = self._branches.setdefault(restaurant_id, [])
        # Check uniqueness of branch_code within restaurant
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
        if data.is_primary:
            for b in branches:
                b["is_primary"] = False
        branches.append(new_branch)
        return BranchResponse(**new_branch)

    def list_members(self, restaurant_id: str) -> List[MemberResponse]:
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

    def add_member(self, restaurant_id: str, invite: MemberInvite, actor_id: str) -> MemberResponse:
        actor_role = self.resolve_user_membership(restaurant_id, actor_id)
        if not actor_role or not has_sufficient_role(actor_role, "admin"):
            raise PermissionError("Only admins or owners can add members.")

        if invite.role.lower() == "owner" and actor_role != "owner":
            raise PermissionError("Only current owners can grant owner privileges.")

        # Find existing user profile by email if registered, else generate deterministic placeholder ID
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
        members.append(new_membership)

        return MemberResponse(
            id=membership_id,
            restaurant_id=restaurant_id,
            user_id=invited_user_id,
            email=invite.email.lower(),
            full_name=invite.email.split("@")[0],
            role=invite.role.lower(),
            created_at=now_str
        )

    def remove_member(self, restaurant_id: str, membership_id: str, actor_id: str):
        actor_role = self.resolve_user_membership(restaurant_id, actor_id)
        if not actor_role or not has_sufficient_role(actor_role, "admin"):
            raise PermissionError("Only admins or owners can remove members.")

        members = self._memberships.get(restaurant_id, [])
        target = next((m for m in members if m["id"] == membership_id), None)
        if not target:
            raise KeyError("Membership not found.")

        if target["role"] == "owner" and actor_role != "owner":
            raise PermissionError("Admins cannot remove restaurant owners.")

        # Prevent removing the sole owner
        if target["role"] == "owner":
            owner_count = sum(1 for m in members if m["role"] == "owner")
            if owner_count <= 1:
                raise ValueError("Cannot remove the only owner of a restaurant.")

        self._memberships[restaurant_id] = [m for m in members if m["id"] != membership_id]

    def get_settings(self, restaurant_id: str) -> RestaurantSettingsResponse:
        st = self._settings.get(restaurant_id, {
            "restaurant_id": restaurant_id,
            "default_prep_buffer": 10,
            "default_forecasting_frequency": "daily",
            "auto_forecast_on_upload": True
        })
        return RestaurantSettingsResponse(**st)

    def update_settings(self, restaurant_id: str, data: RestaurantSettingsUpdate, actor_id: str) -> RestaurantSettingsResponse:
        actor_role = self.resolve_user_membership(restaurant_id, actor_id)
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
        return RestaurantSettingsResponse(**current)

    def reset_for_testing(self):
        """Clears in-memory collections for test isolation."""
        self._restaurants.clear()
        self._memberships.clear()
        self._branches.clear()
        self._settings.clear()
        self._users.clear()

tenant_service = TenantService()
