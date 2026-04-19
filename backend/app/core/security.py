import base64
import hashlib
import os
import secrets


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    derived_key = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=2**14,
        r=8,
        p=1,
    )

    return "scrypt$16384$8$1$" + "$".join(
        [
            base64.b64encode(salt).decode("utf-8"),
            base64.b64encode(derived_key).decode("utf-8"),
        ]
    )


def verify_password(password: str, encoded_password: str) -> bool:
    try:
        algorithm, n_value, r_value, p_value, encoded_salt, encoded_key = encoded_password.split("$")
    except ValueError:
        return False

    if algorithm != "scrypt":
        return False

    salt = base64.b64decode(encoded_salt.encode("utf-8"))
    expected_key = base64.b64decode(encoded_key.encode("utf-8"))
    derived_key = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=int(n_value),
        r=int(r_value),
        p=int(p_value),
    )

    return secrets.compare_digest(derived_key, expected_key)

