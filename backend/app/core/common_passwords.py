"""A11: curated list of extremely common / breached passwords.

Compiled from publicly-published "most common passwords" lists (annual
NCSC/SplashData/Have I Been Pwned roundups) — not a full breach corpus. It
exists to catch the passwords an attacker tries first in a credential-
stuffing or password-spraying attempt; it is not a substitute for a live
breach-database check (e.g. the Have I Been Pwned Pwned Passwords API),
which would be the natural next step if this needs to get stronger.

Matching is case-insensitive exact match against the whole password (see
_validate_password_strength in services/auth.py) — deliberately not fuzzy,
so passphrases containing common words are not penalised.
"""

COMMON_PASSWORDS: frozenset[str] = frozenset(
    p.lower()
    for p in [
        # ── Numeric sequences ────────────────────────────────────────────
        "123456", "1234567", "12345678", "123456789", "1234567890",
        "12345", "123123", "1231234", "111111", "1111111", "11111111",
        "000000", "00000000", "121212", "123321", "654321", "696969",
        "112233", "102030", "159753", "147258", "13131313", "789456",
        "987654321", "123123123", "1q2w3e4r", "1q2w3e4r5t", "1qaz2wsx",
        "qazwsx", "qazwsxedc", "zaq12wsx",
        # ── Keyboard patterns ────────────────────────────────────────────
        "qwerty", "qwerty123", "qwertyuiop", "qwe123", "asdfgh", "asdfghjkl",
        "zxcvbnm", "zxcvbn", "asdf1234", "1qaz2wsx3edc", "qwerty1", "qweasd",
        "qwerty12345", "asdasd", "poiuytrewq",
        # ── "password" variants ─────────────────────────────────────────
        "password", "password1", "password123", "password1234", "passw0rd",
        "passw0rd1", "p@ssword", "p@ssw0rd", "p@ssword1", "pa55word",
        "password!", "password12", "1password", "mypassword", "passwords",
        # ── Common words / phrases ──────────────────────────────────────
        "letmein", "letmein1", "letmein123", "trustno1", "iloveyou",
        "iloveyou1", "iloveyou123", "whatever", "welcome", "welcome1",
        "welcome123", "monkey", "monkey1", "monkey123", "dragon", "dragon123",
        "master", "master123", "shadow", "sunshine", "princess",
        "princess1", "superman", "batman", "starwars", "freedom", "flower",
        "hello", "hello123", "hello1", "hunter", "hunter2", "football",
        "football1", "baseball", "basketball", "soccer", "jordan23",
        "michael", "charlie", "michelle", "jennifer", "jessica", "amanda",
        "ashley", "nicole", "daniel", "andrew", "joshua", "matthew",
        "ginger", "cheese", "banana", "orange", "purple", "yellow",
        "chicken", "elephant", "tigger", "pepper", "cookie", "peanut",
        # ── Admin / default-credential style ─────────────────────────────
        "admin", "admin123", "administrator", "root", "root123", "toor",
        "guest", "guest123", "test", "test123", "test1234", "demo",
        "changeme", "changeme123", "default", "user", "user123", "temp",
        "temp123", "temppass", "newpass", "newpassword", "oldpassword",
        "system", "system123", "server", "backup",
        # ── Sports / hobbies ─────────────────────────────────────────────
        "arsenal", "chelsea", "liverpool", "manutd", "barcelona", "madrid",
        "golfer", "hockey", "cricket", "fishing", "shopping", "gaming",
        # ── Keyboard-adjacent + leetspeak ────────────────────────────────
        "l3tm31n", "adm1n", "p4ssw0rd", "qw3rty", "abc123", "abc12345",
        "abcd1234", "a1b2c3", "aa123456", "123abc", "1a2b3c4d",
        # ── Common numeric+word combos ───────────────────────────────────
        "spree123", "spree1234", "ghana123", "accra123", "kumasi123",
        "vendor123", "seller123", "shopping123", "market123", "store123",
        "myspace1", "google123", "facebook1", "instagram1", "twitter1",
        # ── Year-based (evergreen) ────────────────────────────────────────
        "password2020", "password2021", "password2022", "password2023",
        "password2024", "password2025", "password2026", "welcome2020",
        "welcome2021", "welcome2022", "welcome2023", "welcome2024",
        # ── Repeated / trivial patterns ───────────────────────────────────
        "aaaaaa", "aaaaaaaa", "bbbbbb", "cccccc", "aaaaaa1", "1234qwer",
        "qqqqqq", "wwwwww", "zzzzzz", "xxxxxx",
    ]
)
