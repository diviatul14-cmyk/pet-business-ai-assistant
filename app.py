import os
import re
from datetime import datetime

import pandas as pd
import streamlit as st
from PIL import Image, ImageOps, ImageChops, ImageDraw

from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from huggingface_hub import InferenceClient


# ============================================================
# PAGE CONFIG
# ============================================================

st.set_page_config(
    page_title="PETORA | Pets Beyond Borders",
    page_icon="🐾",
    layout="wide",
    initial_sidebar_state="collapsed",
)


# ============================================================
# PATHS
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DATA_DIR = os.path.join(BASE_DIR, "data")
IMAGE_DIR = os.path.join(BASE_DIR, "images")

PUPPY_FILE = os.path.join(DATA_DIR, "puppies.csv")
KNOWLEDGE_FILE = os.path.join(DATA_DIR, "info.text")
ENQUIRY_FILE = os.path.join(DATA_DIR, "enquiries.csv")
LOGO_FILE = os.path.join(IMAGE_DIR, "petora-logo.png")


# ============================================================
# CUSTOM CSS
# ============================================================

st.markdown(
    """
<style>

/* ==========================================================
   GLOBAL
   ========================================================== */

html, body, [class*="css"] {
    font-family: Arial, Helvetica, sans-serif;
}

.stApp {
    background: #f8f7f1;
}

.block-container {
    max-width: 1450px;
    padding-top: 1rem;
    padding-bottom: 2rem;
}


/* ==========================================================
   TOP BRAND HEADER
   ========================================================== */

.brand-wrap {
    background: linear-gradient(
        100deg,
        #eef3ea 0%,
        #ffffff 48%,
        #e9efe5 100%
    );

    border: 1px solid #d9dfd4;
    border-radius: 20px;

    padding: 12px 24px;

    margin-bottom: 10px;

    box-shadow: 0 5px 18px rgba(0,0,0,0.05);
}

.brand-wrap img {
    display: block;
    margin: 0 auto;
}

.brand-sub {
    text-align: center;
    color: #9b7424;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 3px;
}

.brand-line {
    text-align: center;
    color: #345d44;
    font-size: 16px;
    font-style: italic;
    margin-top: 3px;
}


/* ==========================================================
   NAV
   ========================================================== */

.nav-wrap {
    background: #0b4428;
    color: white;

    border-radius: 14px;

    padding: 13px 16px;

    text-align: center;

    font-size: 15px;
    font-weight: 700;

    box-shadow: 0 6px 14px rgba(11,68,40,0.15);

    margin-bottom: 22px;
}


/* ==========================================================
   HERO
   ========================================================== */

.hero {
    background:
        linear-gradient(
            110deg,
            #f7f2e6 0%,
            #ffffff 52%,
            #edf3e9 100%
        );

    border: 1px solid #ded9ca;

    border-radius: 22px;

    padding: 34px 38px;

    box-shadow: 0 7px 20px rgba(0,0,0,0.05);

    margin-bottom: 22px;

    position: relative;
    overflow: hidden;
}

.hero:after {
    content: "🐕     🐈     🐟     🐍     🦜";
    position: absolute;
    right: 25px;
    bottom: 14px;
    font-size: 27px;
    opacity: 0.20;
}

.hero-small {
    color: #a1781e;
    font-size: 14px;
    font-weight: 900;
    letter-spacing: 2px;
    text-transform: uppercase;
}

.hero-title {
    color: #103d27;
    font-size: 44px;
    line-height: 1.1;
    font-weight: 900;
    margin-top: 7px;
}

.hero-description {
    color: #575757;
    font-size: 18px;
    line-height: 1.6;
    max-width: 930px;
    margin-top: 10px;
}


/* ==========================================================
   FEATURE STRIP
   ========================================================== */

.feature-card {
    background: #ffffff;

    border: 1px solid #e1ddd4;

    border-radius: 15px;

    padding: 16px 10px;

    min-height: 125px;

    text-align: center;

    box-shadow: 0 5px 14px rgba(0,0,0,0.04);
}

.feature-icon {
    font-size: 29px;
}

.feature-title {
    color: #17482d;
    font-weight: 800;
    margin-top: 5px;
}

.feature-text {
    color: #777;
    font-size: 13px;
    margin-top: 3px;
}


/* ==========================================================
   SECTION HEADERS
   ========================================================== */

.section-heading {
    color: #123d27;
    font-size: 30px;
    font-weight: 900;
    margin-top: 20px;
    margin-bottom: 4px;
}

.section-subheading {
    color: #777;
    font-size: 15px;
    margin-bottom: 15px;
}


/* ==========================================================
   PUPPY CARD
   ========================================================== */

.puppy-card {
    background: #ffffff;

    border: 1px solid #ddd9cf;

    border-radius: 18px;

    overflow: hidden;

    box-shadow: 0 7px 18px rgba(0,0,0,0.06);

    margin-bottom: 10px;
}

.puppy-card img {
    width: 100%;
    height: 255px;
    object-fit: cover;
    display: block;
}

.puppy-content {
    padding: 15px 16px 8px 16px;
}

.puppy-breed {
    color: #143f28;
    font-size: 21px;
    font-weight: 900;
}

.puppy-id {
    color: #787878;
    font-size: 13px;
    margin-top: 3px;
}

.puppy-row {
    color: #4a4a4a;
    margin-top: 8px;
    font-size: 14px;
}

.puppy-price {
    color: #1a743c;
    font-size: 26px;
    font-weight: 900;
    margin-top: 10px;
}

.available {
    display: inline-block;
    background: #e1f6e7;
    color: #23783d;
    border-radius: 40px;
    padding: 5px 10px;
    font-size: 13px;
    font-weight: 800;
    margin-top: 8px;
}

.puppy-footer {
    padding: 0 16px 16px 16px;
}


/* ==========================================================
   AI PANEL
   ========================================================== */

.ai-box {
    background: #ffffff;

    border: 1px solid #ddd9cf;

    border-radius: 20px;

    box-shadow: 0 7px 18px rgba(0,0,0,0.06);

    padding: 20px;

    min-height: 300px;
}

.ai-title {
    color: #103d27;
    font-size: 25px;
    font-weight: 900;
}

.ai-subtitle {
    color: #777;
    font-size: 14px;
    margin-top: 3px;
}

.chat-user {
    background: #1c6f3a;
    color: white;
    border-radius: 14px 14px 4px 14px;
    padding: 10px 13px;
    margin: 10px 0 8px 28px;
    font-size: 14px;
}

.chat-ai {
    background: #f0f3ef;
    color: #303030;
    border-radius: 14px 14px 14px 4px;
    padding: 10px 13px;
    margin: 8px 28px 10px 0;
    font-size: 14px;
}


/* ==========================================================
   TRUST BAR
   ========================================================== */

.trust-wrap {
    background: #edf5ea;

    border: 1px solid #d6e2d1;

    border-radius: 17px;

    padding: 18px 12px;

    margin-top: 25px;

    text-align: center;
}

.trust-line {
    color: #194a2f;
    font-size: 16px;
    font-weight: 800;
}

.trust-note {
    color: #707070;
    font-size: 13px;
    margin-top: 7px;
}


/* ==========================================================
   LEAD FORM
   ========================================================== */

.lead-box {
    background: #ffffff;

    border: 1px solid #ddd9cf;

    border-radius: 18px;

    padding: 22px;

    margin-top: 20px;

    box-shadow: 0 6px 16px rgba(0,0,0,0.05);
}


/* ==========================================================
   FOOTER
   ========================================================== */

.footer {
    background: #0b4428;

    color: white;

    border-radius: 18px;

    padding: 30px 20px;

    text-align: center;

    margin-top: 28px;
}

.footer-brand {
    font-size: 31px;
    font-weight: 900;
}

.footer-gold {
    color: #e2bd61;
    font-style: italic;
    font-size: 17px;
    margin-top: 4px;
}

.footer-small {
    color: #d7e4da;
    font-size: 13px;
    margin-top: 9px;
}


/* ==========================================================
   STREAMLIT BUTTON
   ========================================================== */

.stButton > button {
    width: 100%;

    min-height: 42px;

    border-radius: 10px;

    border: none;

    background: #b8892d;

    color: white;

    font-weight: 800;
}

.stButton > button:hover {
    background: #936a1e;
    color: white;
}


/* ==========================================================
   CHAT INPUT / TEXT INPUT
   ========================================================== */

.stTextInput input {
    border-radius: 12px;
}

</style>
""",
    unsafe_allow_html=True,
)


# ============================================================
# UTILITY: CROP LOGO WHITESPACE
# ============================================================

def crop_logo(image):

    """
    Removes large uniform borders around the logo so the
    supplied poster-style PNG behaves more like a normal logo.
    """

    try:

        image = image.convert("RGB")

        background = Image.new(
            "RGB",
            image.size,
            image.getpixel((0, 0))
        )

        diff = ImageChops.difference(
            image,
            background
        )

        diff = ImageOps.grayscale(
            diff
        )

        bbox = diff.getbbox()

        if bbox:

            image = image.crop(bbox)

        return image

    except Exception:

        return image


# ============================================================
# BRAND HEADER
# ============================================================

st.html(
    """
    <div class="brand-wrap">
    """
)


if os.path.exists(LOGO_FILE):

    try:

        logo_image = Image.open(
            LOGO_FILE
        )

        logo_image = crop_logo(
            logo_image
        )

        st.image(
            logo_image,
            width=430
        )

    except Exception:

        st.html(
            """
            <div style="
                text-align:center;
                color:#103d27;
                font-size:44px;
                font-weight:900;
            ">
                PETORA™
            </div>
            """
        )

else:

    st.html(
        """
        <div style="
            text-align:center;
            color:#103d27;
            font-size:44px;
            font-weight:900;
        ">
            PETORA™
        </div>
        """
    )


st.html(
    """
    <div class="brand-sub">
        PETS BEYOND BORDERS
    </div>

    <div class="brand-line">
        More Pets. A Wilder World.
    </div>

    </div>
    """
)


# ============================================================
# NAVIGATION
# ============================================================

st.html(
    """
    <div class="nav-wrap">
        🏠 Home
        &nbsp;&nbsp; | &nbsp;&nbsp;
        🐶 Dogs
        &nbsp;&nbsp; | &nbsp;&nbsp;
        🐱 Cats
        &nbsp;&nbsp; | &nbsp;&nbsp;
        🐟 Aquatics
        &nbsp;&nbsp; | &nbsp;&nbsp;
        🐍 Reptiles
        &nbsp;&nbsp; | &nbsp;&nbsp;
        🦜 Exotic Pets
        &nbsp;&nbsp; | &nbsp;&nbsp;
        🤖 AI Assistant
        &nbsp;&nbsp; | &nbsp;&nbsp;
        ℹ️ About
    </div>
    """
)


# ============================================================
# HERO
# ============================================================

st.html(
    """
    <div class="hero">

        <div class="hero-small">
            Welcome to PETORA
        </div>

        <div class="hero-title">
            Your Complete Pet Companion
        </div>

        <div class="hero-description">
            Find puppies, explore pets, check availability,
            ask PETORA AI questions and send an enquiry —
            all in one place.
        </div>

    </div>
    """
)


# ============================================================
# FEATURES
# ============================================================

feature_columns = st.columns(4)

feature_data = [
    (
        "✅",
        "Verified Information",
        "Clear puppy details and records."
    ),
    (
        "🚚",
        "Safe & Convenient",
        "Simple enquiry and support."
    ),
    (
        "❤️",
        "Pet First",
        "Care-focused pet guidance."
    ),
    (
        "🤖",
        "PETORA AI",
        "Instant answers from your data."
    ),
]


for column, item in zip(
    feature_columns,
    feature_data
):

    icon, title, text = item

    with column:

        st.html(
            f"""
            <div class="feature-card">

                <div class="feature-icon">
                    {icon}
                </div>

                <div class="feature-title">
                    {title}
                </div>

                <div class="feature-text">
                    {text}
                </div>

            </div>
            """
        )


# ============================================================
# LOAD INVENTORY
# ============================================================

@st.cache_data
def load_inventory():

    if not os.path.exists(
        PUPPY_FILE
    ):

        return pd.DataFrame()

    try:

        return pd.read_csv(
            PUPPY_FILE
        )

    except Exception:

        return pd.DataFrame()


inventory = load_inventory()


if inventory.empty:

    st.error(
        "Could not load data/puppies.csv"
    )

    st.stop()


# ============================================================
# REQUIRED COLUMNS
# ============================================================

required_columns = [
    "puppy_id",
    "breed",
    "gender",
    "age_weeks",
    "price",
    "status",
    "vaccinated",
    "location",
    "photo",
]


for column in required_columns:

    if column not in inventory.columns:

        inventory[column] = ""


# ============================================================
# CLEAN DATA
# ============================================================

for column in [
    "puppy_id",
    "breed",
    "gender",
    "status",
    "vaccinated",
    "location",
    "photo",
]:

    inventory[column] = (
        inventory[column]
        .fillna("")
        .astype(str)
        .str.strip()
    )


inventory["price"] = pd.to_numeric(
    inventory["price"],
    errors="coerce"
).fillna(0)


inventory["age_weeks"] = pd.to_numeric(
    inventory["age_weeks"],
    errors="coerce"
).fillna(0)


# ============================================================
# KNOWLEDGE BASE
# ============================================================

@st.cache_data
def load_knowledge():

    if not os.path.exists(
        KNOWLEDGE_FILE
    ):

        return []

    try:

        with open(
            KNOWLEDGE_FILE,
            "r",
            encoding="utf-8"
        ) as file:

            text = file.read()

    except Exception:

        return []


    chunks = [
        chunk.strip()
        for chunk in re.split(
            r"[\n.!?]+",
            text
        )
        if chunk.strip()
    ]

    return chunks


knowledge_chunks = load_knowledge()


# ============================================================
# EMBEDDING MODEL
# ============================================================

@st.cache_resource
def load_embedding_model():

    return SentenceTransformer(
        "all-MiniLM-L6-v2"
    )


embedding_model = load_embedding_model()


if knowledge_chunks:

    knowledge_embeddings = (
        embedding_model.encode(
            knowledge_chunks
        )
    )

else:

    knowledge_embeddings = None


# ============================================================
# ENQUIRY FILE
# ============================================================

def ensure_enquiry_file():

    if not os.path.exists(
        ENQUIRY_FILE
    ):

        pd.DataFrame(
            columns=[
                "date",
                "name",
                "phone",
                "puppy_id",
                "breed",
                "message",
                "status",
            ]
        ).to_csv(
            ENQUIRY_FILE,
            index=False
        )


ensure_enquiry_file()


# ============================================================
# SAVE ENQUIRY
# ============================================================

def save_enquiry(
    name,
    phone,
    puppy_id,
    breed,
    message
):

    row = pd.DataFrame(
        [
            {
                "date": datetime.now().strftime(
                    "%Y-%m-%d %H:%M:%S"
                ),
                "name": name,
                "phone": phone,
                "puppy_id": puppy_id,
                "breed": breed,
                "message": message,
                "status": "New",
            }
        ]
    )

    row.to_csv(
        ENQUIRY_FILE,
        mode="a",
        header=False,
        index=False
    )


# ============================================================
# HELPERS
# ============================================================

def find_puppy_id(text):

    match = re.search(
        r"\b[A-Za-z]{2}\d{3}\b",
        text
    )

    if match:

        return match.group(0).upper()

    return ""


def find_puppy(puppy_id):

    if not puppy_id:

        return None

    result = inventory[
        inventory["puppy_id"]
        .str.upper()
        .eq(
            puppy_id.upper()
        )
    ]

    if not result.empty:

        return result.iloc[0]

    return None


def detect_buying_intent(text):

    keywords = [
        "interested",
        "buy",
        "buying",
        "purchase",
        "book",
        "booking",
        "reserve",
        "reservation",
        "want this puppy",
        "want to buy",
        "i want",
        "i would like",
    ]

    lower = text.lower()

    return any(
        word in lower
        for word in keywords
    )


# ============================================================
# SESSION STATE
# ============================================================

if "messages" not in st.session_state:

    st.session_state.messages = []


if "lead_request" not in st.session_state:

    st.session_state.lead_request = None


# ============================================================
# MAIN TWO-COLUMN AREA
# ============================================================

left_column, right_column = st.columns(
    [1.7, 1],
    gap="large"
)


# ============================================================
# LEFT COLUMN
# ============================================================

with left_column:

    st.html(
        """
        <div class="section-heading">
            🐾 Available Puppies
        </div>

        <div class="section-subheading">
            Browse our current puppy inventory.
            Click "I'm Interested" to send an enquiry.
        </div>
        """
    )


    available = inventory[
        inventory["status"]
        .str.lower()
        .eq("available")
    ].copy()


    if available.empty:

        st.info(
            "No puppies are currently available."
        )

    else:

        cards = st.columns(
            min(
                3,
                len(available)
            )
        )


        for index, (_, puppy) in enumerate(
            available.iterrows()
        ):

            with cards[
                index % len(cards)
            ]:

                # --------------------------------------------
                # IMAGE
                # --------------------------------------------

                photo = str(
                    puppy["photo"]
                ).strip().lstrip("/")


                image_path = os.path.join(
                    BASE_DIR,
                    photo
                )


                if (
                    photo
                    and os.path.isfile(
                        image_path
                    )
                ):

                    try:

                        image = Image.open(
                            image_path
                        ).convert(
                            "RGB"
                        )

                        image = ImageOps.fit(
                            image,
                            (600, 450),
                            method=Image.Resampling.LANCZOS,
                            centering=(0.5, 0.5)
                        )

                        st.image(
                            image,
                            width="stretch"
                        )

                    except Exception:

                        st.info(
                            "Image unavailable."
                        )

                else:

                    st.info(
                        "Image unavailable."
                    )


                # --------------------------------------------
                # DETAILS
                # --------------------------------------------

                st.html(
                    f"""
                    <div class="puppy-card">

                        <div class="puppy-content">

                            <div class="puppy-breed">
                                🐶 {puppy['breed']}
                            </div>

                            <div class="puppy-id">
                                Puppy ID:
                                <b>{puppy['puppy_id']}</b>
                            </div>

                            <div class="puppy-row">
                                Gender:
                                <b>{puppy['gender']}</b>
                            </div>

                            <div class="puppy-row">
                                Age:
                                <b>{int(puppy['age_weeks'])} weeks</b>
                            </div>

                            <div class="puppy-price">
                                ₹{puppy['price']:,.0f}
                            </div>

                            <span class="available">
                                ✓ Available
                            </span>

                            <div class="puppy-row">
                                Vaccinated:
                                <b>{puppy['vaccinated']}</b>
                            </div>

                            <div class="puppy-row">
                                Location:
                                <b>{puppy['location']}</b>
                            </div>

                        </div>

                    </div>
                    """
                )


                if st.button(
                    "📞 I'm Interested",
                    key=(
                        f"interest_"
                        f"{puppy['puppy_id']}"
                    )
                ):

                    st.session_state.lead_request = {
                        "puppy_id": str(
                            puppy["puppy_id"]
                        ),
                        "message": (
                            "Customer is interested in "
                            f"{puppy['puppy_id']}"
                        ),
                    }

                    st.rerun()


# ============================================================
# RIGHT COLUMN - AI
# ============================================================

with right_column:

    st.html(
        """
        <div class="ai-box">

            <div class="ai-title">
                🤖 PETORA AI Assistant
            </div>

            <div class="ai-subtitle">
                Ask about puppies, prices, availability,
                breeds or pet care.
            </div>

        </div>
        """
    )


    # --------------------------------------------
    # CHAT HISTORY
    # --------------------------------------------

    for message in st.session_state.messages:

        if message["role"] == "user":

            st.html(
                f"""
                <div class="chat-user">
                    {message["content"]}
                </div>
                """
            )

        else:

            # Escape HTML-sensitive characters so that
            # AI responses are displayed safely.
            safe_answer = (
                str(
                    message["content"]
                )
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\n", "<br>")
            )

            st.html(
                f"""
                <div class="chat-ai">
                    {safe_answer}
                </div>
                """
            )


    # --------------------------------------------
    # CHAT INPUT
    # --------------------------------------------

    with st.form(
        "petora_chat_form",
        clear_on_submit=True
    ):

        question = st.text_input(
            "Ask PETORA AI",
            placeholder=(
                "Ask about puppies, "
                "prices or availability..."
            ),
            label_visibility="collapsed",
        )

        ask_button = st.form_submit_button(
            "➤ Ask PETORA"
        )


    if ask_button and question.strip():

        query = question.strip()


        st.session_state.messages.append(
            {
                "role": "user",
                "content": query,
            }
        )


        puppy_id = find_puppy_id(
            query
        )

        puppy = find_puppy(
            puppy_id
        )


        # -----------------------------------------
        # BUYING INTENT
        # -----------------------------------------

        if detect_buying_intent(
            query
        ):

            st.session_state.lead_request = {
                "puppy_id": puppy_id,
                "message": query,
            }


        # -----------------------------------------
        # EXACT PUPPY LOOKUP
        # -----------------------------------------

        if (
            puppy_id
            and puppy is not None
        ):

            if (
                str(
                    puppy["status"]
                ).lower()
                == "available"
            ):

                answer = (
                    f"{puppy_id} is available.\n\n"
                    f"Breed: {puppy['breed']}\n"
                    f"Gender: {puppy['gender']}\n"
                    f"Age: {int(puppy['age_weeks'])} weeks\n"
                    f"Price: ₹{puppy['price']:,.0f}\n"
                    f"Vaccinated: {puppy['vaccinated']}\n"
                    f"Location: {puppy['location']}"
                )

            else:

                answer = (
                    f"{puppy_id} is currently "
                    f"{str(puppy['status']).lower()}."
                )


        else:

            # -----------------------------------------
            # RAG CONTEXT
            # -----------------------------------------

            inventory_terms = [
                "price",
                "puppy",
                "puppies",
                "available",
                "availability",
                "breed",
                "male",
                "female",
                "vaccinated",
                "sold",
                "age",
                "inventory",
                "location",
            ]


            if any(
                term in query.lower()
                for term in inventory_terms
            ):

                context = (
                    "CURRENT INVENTORY:\n\n"
                    + inventory.to_string(
                        index=False
                    )
                )

            elif (
                knowledge_embeddings is not None
                and knowledge_chunks
            ):

                query_embedding = (
                    embedding_model.encode(
                        [query]
                    )
                )

                similarities = cosine_similarity(
                    query_embedding,
                    knowledge_embeddings
                )[0]

                top_indices = (
                    similarities.argsort()[
                        -3:
                    ][::-1]
                )

                context = "\n".join(
                    knowledge_chunks[i]
                    for i in top_indices
                )

            else:

                context = ""


            # -----------------------------------------
            # HUGGING FACE
            # -----------------------------------------

            try:

                hf_token = st.secrets[
                    "HF_TOKEN"
                ]

            except Exception:

                hf_token = None


            if not hf_token:

                answer = (
                    "PETORA AI is not configured. "
                    "Please add HF_TOKEN in Streamlit Secrets."
                )

            else:

                try:

                    client = InferenceClient(
                        api_key=hf_token,
                        provider="auto"
                    )


                    result = (
                        client.chat.completions.create(
                            model=(
                                "Qwen/"
                                "Qwen2.5-7B-Instruct"
                            ),
                            messages=[
                                {
                                    "role": "system",
                                    "content": (
                                        "You are PETORA AI "
                                        "Assistant for a pet "
                                        "business. Use ONLY "
                                        "the provided context. "
                                        "Never invent puppy "
                                        "prices, breeds, ages, "
                                        "availability, "
                                        "vaccination data or "
                                        "locations. If the "
                                        "answer is not present, "
                                        "say: I don't know "
                                        "based on the available "
                                        "information. Keep the "
                                        "answer helpful and "
                                        "concise."
                                    ),
                                },
                                {
                                    "role": "user",
                                    "content": (
                                        f"Context:\n"
                                        f"{context}\n\n"
                                        f"Question:\n"
                                        f"{query}"
                                    ),
                                },
                            ],
                            max_tokens=300,
                            temperature=0.2,
                        )
                    )


                    answer = (
                        result
                        .choices[0]
                        .message
                        .content
                    )


                except Exception:

                    answer = (
                        "PETORA AI is temporarily "
                        "unavailable. Please try again."
                    )


        st.session_state.messages.append(
            {
                "role": "assistant",
                "content": answer,
            }
        )

        st.rerun()


# ============================================================
# LEAD CAPTURE
# ============================================================

if st.session_state.lead_request:

    st.markdown(
        "<br>",
        unsafe_allow_html=True
    )

    st.html(
        """
        <div class="lead-box">

            <div class="section-heading">
                📞 Interested in a Puppy?
            </div>

        </div>
        """
    )


    lead_id = (
        st.session_state.lead_request[
            "puppy_id"
        ]
    )

    lead_message = (
        st.session_state.lead_request[
            "message"
        ]
    )

    lead_puppy = find_puppy(
        lead_id
    )


    if lead_puppy is not None:

        lead_breed = str(
            lead_puppy["breed"]
        )

        st.write(
            f"Enquiry for **{lead_id} "
            f"({lead_breed})**"
        )

    else:

        lead_breed = ""

        st.write(
            "Please specify the puppy you are interested in."
        )


    with st.form(
        "petora_lead_form"
    ):

        name = st.text_input(
            "Your Name",
            placeholder="Enter your name"
        )

        phone = st.text_input(
            "Phone Number",
            placeholder="Enter your phone number"
        )

        submit = st.form_submit_button(
            "📩 Submit Enquiry"
        )


        if submit:

            if not name.strip():

                st.error(
                    "Please enter your name."
                )

            elif not phone.strip():

                st.error(
                    "Please enter your phone number."
                )

            else:

                save_enquiry(
                    name.strip(),
                    phone.strip(),
                    lead_id,
                    lead_breed,
                    lead_message
                )

                st.success(
                    "✅ Your enquiry has been submitted successfully!"
                )

                st.session_state.lead_request = None

                st.rerun()


# ============================================================
# TRUST BAR
# ============================================================

st.html(
    """
    <div class="trust-wrap">

        <div class="trust-line">
            🐾 Wide Range of Pets
            &nbsp; • &nbsp;
            🌿 Ethical & Responsible
            &nbsp; • &nbsp;
            🚚 Pan India
            &nbsp; • &nbsp;
            ❤️ Support & Guidance
        </div>

        <div class="trust-note">
            PETORA is designed to grow from puppies
            into a broader pet marketplace.
        </div>

    </div>
    """
)


# ============================================================
# FOOTER
# ============================================================

st.html(
    """
    <div class="footer">

        <div class="footer-brand">
            PETORA™
        </div>

        <div class="footer-gold">
            More Pets. A Wilder World.
        </div>

        <div class="footer-small">
            Dogs • Cats • Aquatics • Reptiles • Exotic Pets
        </div>

        <div class="footer-small">
            Care • Trust • Passion • For Every Species
        </div>

    </div>
    """
)