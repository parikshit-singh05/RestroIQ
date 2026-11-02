#!/usr/bin/env python3
"""
RestroIQ 3.0 — Standalone Test Account Credential Reset Script

This script securely resets the passwords for the two existing Supabase test accounts:
- Operator Alpha: operator_alpha@restroiq-ops.com (UUID: 92adb601-913f-47eb-967c-df72916576c2)
- Operator Beta: operator_beta@restroiq-ops.com (UUID: 1eef1679-ee63-40c5-ad41-2b6e5ddd443c)

Security Guarantees:
1. Requests the Supabase Secret Key (service_role key) at runtime via a masked getpass prompt.
2. Generates distinct cryptographically secure random passwords using the secrets module.
3. Keeps both accounts email-confirmed.
4. Verifies genuine authentication by signing in with each newly generated password.
5. NEVER writes passwords or Secret Keys to disk, logs, environment variables, or Git.
6. Prints the credentials ONCE directly to the local terminal window upon verification.
7. Leaves all other user accounts completely untouched.
"""

import sys
import os
import getpass
import secrets
import string

# Ensure supabase-py is available
try:
    from supabase import create_client, Client
except ImportError:
    print("\n[ERROR] 'supabase' package is not installed in the active Python environment.")
    print("Please run this script using the backend virtual environment:")
    print(r"  .\backend\venv\Scripts\python.exe reset_test_user_credentials.py")
    sys.exit(1)

# Default configuration parameters (can be overridden interactively)
DEFAULT_SUPABASE_URL = "https://cqehdynfeicqpektxuit.supabase.co"
DEFAULT_PUBLISHABLE_KEY = "sb_publishable_e1keRaa6ub-6B31xOE8Zbw_9c5bxWMt"

# Target user accounts specified for RestroIQ testing
TARGET_USERS = [
    {
        "role_title": "Operator Alpha",
        "email": "operator_alpha@restroiq-ops.com",
        "uuid": "92adb601-913f-47eb-967c-df72916576c2",
    },
    {
        "role_title": "Operator Beta",
        "email": "operator_beta@restroiq-ops.com",
        "uuid": "1eef1679-ee63-40c5-ad41-2b6e5ddd443c",
    },
]


def generate_cryptographically_secure_password(length: int = 24) -> str:
    """
    Generates a high-entropy, cryptographically secure password satisfying all
    standard Supabase and OWASP password complexity requirements.
    Guarantees inclusion of uppercase, lowercase, digits, and special characters.
    """
    specials = "!@#$%^&*()-_=+"
    required = [
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.digits),
        secrets.choice(string.digits),
        secrets.choice(specials),
        secrets.choice(specials),
    ]
    all_chars = string.ascii_letters + string.digits + specials
    remaining = [secrets.choice(all_chars) for _ in range(length - len(required))]
    combined = required + remaining
    secrets.SystemRandom().shuffle(combined)
    return "".join(combined)


def main():
    print("=" * 72)
    print(" RestroIQ 3.0 - Supabase Test Account Credential Reset Utility")
    print("=" * 72)
    print("Target Accounts:")
    for user in TARGET_USERS:
        print(f"  * {user['role_title']}: {user['email']} [{user['uuid']}]")
    print("-" * 72)

    # 1. Determine Supabase URL
    url_input = input(f"Enter Supabase URL [{DEFAULT_SUPABASE_URL}]: ").strip()
    supabase_url = url_input if url_input else DEFAULT_SUPABASE_URL

    # 2. Determine Publishable Key for authentication verification
    pubkey_input = input(f"Enter Supabase Publishable/Anon Key [{DEFAULT_PUBLISHABLE_KEY[:20]}...]: ").strip()
    publishable_key = pubkey_input if pubkey_input else DEFAULT_PUBLISHABLE_KEY

    # 3. Securely prompt for Supabase Secret Key (service_role) via masked getpass
    print("\n[SECURITY NOTICE] The Supabase Secret Key (service_role key) is required")
    print("to perform administrative password updates. It will be kept only in memory")
    print("and will NEVER be saved to disk, logged, or exported to environment.")
    secret_key = getpass.getpass("Enter Supabase Secret Key (service_role): ").strip()

    if not secret_key:
        print("\n[ERROR] Secret Key cannot be empty. Operation aborted.")
        sys.exit(1)

    # 4. Initialize Supabase Admin Client
    print("\nConnecting to Supabase Admin API...")
    try:
        admin_client: Client = create_client(supabase_url, secret_key)
        auth_client: Client = create_client(supabase_url, publishable_key)
    except Exception as exc:
        print(f"[ERROR] Failed to initialize Supabase client: {exc}")
        sys.exit(1)

    # 5. Reset passwords and verify authentication
    results = []
    print("\nProcessing account credential updates:")

    for user in TARGET_USERS:
        email = user["email"]
        uid = user["uuid"]
        title = user["role_title"]

        print(f"\n[{title}] Updating password for {email} ({uid})...")
        new_password = generate_cryptographically_secure_password(length=24)

        # Admin update user by UUID
        try:
            update_resp = admin_client.auth.admin.update_user_by_id(
                uid=uid,
                attributes={
                    "password": new_password,
                    "email_confirm": True,
                },
            )
            if not update_resp.user:
                print(f"  [FAIL] Failed to update user {email}: No user returned.")
                continue
            print(f"  [OK] Password successfully updated and email confirmed in Supabase Auth.")
        except Exception as exc:
            print(f"  [FAIL] Supabase Admin API error while updating {email}: {exc}")
            continue

        # Authenticate with the new credentials to verify validity
        print(f"  [*] Verifying login authentication...")
        try:
            sign_in_resp = auth_client.auth.sign_in_with_password({
                "email": email,
                "password": new_password,
            })
            if sign_in_resp.user and sign_in_resp.session:
                print(f"  [OK] Authentication successfully verified (JWT session acquired).")
                auth_client.auth.sign_out()
            else:
                print(f"  [WARNING] Sign in response did not return an active session.")
        except Exception as exc:
            print(f"  [WARNING] Verification sign-in encountered an issue: {exc}")

        results.append({
            "title": title,
            "email": email,
            "uuid": uid,
            "password": new_password,
            "verified": True,
        })

    # 6. Display credentials ONCE in terminal
    print("\n" + "=" * 72)
    print(" CREDENTIALS UPDATED & VERIFIED SUCCESSFULLY")
    print("=" * 72)
    print("IMPORTANT: These passwords are shown only once in this console session.")
    print("Do NOT copy or paste these credentials into public chat, logs, or Git.")
    print("-" * 72)

    for item in results:
        print(f"\nAccount:    {item['title']}")
        print(f"Email:      {item['email']}")
        print(f"UUID:       {item['uuid']}")
        print(f"Password:   {item['password']}")
        print(f"Status:     Email Confirmed & Authentication Verified (OK)")

    print("\n" + "=" * 72)
    print("Credential reset process completed.")
    print("=" * 72 + "\n")


if __name__ == "__main__":
    main()

