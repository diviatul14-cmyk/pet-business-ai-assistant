import os
import re
import html
from datetime import datetime

import pandas as pd
import streamlit as st
from PIL import Image, ImageOps, ImageChops

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
# SETTINGS
# ============================================================

# Hugging Face model.
# Hugging Face currently documents this model with
# Inference Providers and provider="auto".
HF_MODEL = "deepseek-ai/DeepSeek-V3-0324"


# ============================================================
# CUSTOM CSS
# ============================================================

st.markdown(
    """
<style>

html, body {
    background: #f8f7f1;
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
   BRAND HEADER
   ========================================================== */

.brand-area {
    background: linear-gradient(
        105deg,
        #eef3e9 0%,
        #ffffff 50%,
        #edf3e9 100%
    );

    border: 1px solid #d9dfd4;
    border-radius: 22px;

    padding: 12px 25px 16px 25px;

    margin-bottom: 12px;

    text-align: center;

    box-shadow:
        0 7px 20px rgba(0,0,0,0.05);
}

.brand-area img {
    display: block;
    margin: 0 auto;
    max-width: 430px;
    max-height: 180px;
    object-fit: contain;
}

.brand-subtitle {
    color: #9a731d;
    font-size: 15px;
    font-weight: 900;
    letter-spacing: 3px;
}

.brand-tagline {
    color: #315d41;
    font-size: 16px;
    font-style: italic;
    margin-top: 4px;
}


/* ==========================================================
   NAVIGATION
   ========================================================== */

.nav-bar {
    background: #0d4529;

    color: white;

    border-radius: 14px;

    padding: 14px 10px;

    margin-bottom: 24px;

    text-align: center;

    font-size: 15px;

    font-weight: 800;

    box-shadow:
        0 6px 15px rgba(13,69,41,0.18);
}


/* ==========================================================
   HERO
   ========================================================== */

.hero {
    background:
        linear-gradient(
            110deg,
            #f6f1e4 0%,
            #ffffff 55%,
            #edf4e9 100%
        );

    border: 1px solid #ddd8c9;

    border-radius: 22px;

    padding: 34px 38px;

    margin-bottom: 22px;

    box-shadow:
        0 7px 20px rgba(0,0,0,0.05);
}

.hero-small {
    color: #a1781e;

    font-size: 14px;

    font-weight: 900;

    letter-spacing: 2px;

    text-transform: uppercase;
}

.hero-title {
    color: #123d27;

    font-size: 43px;

    font-weight: 900;

    line-height: 1.1;

    margin-top: 5px;
}

.hero-description {
    color: #555;

    font-size: 18px;

    line-height: 1.6;

    max-width: 950px;

    margin-top: 10px;
}


/* ==========================================================
   FEATURE CARDS
   ========================================================== */

.feature-box {
    background: white;

    border: 1px solid #e2ded4;

    border-radius: 16px;

    padding: 17px 10px;

    text-align: center;

    min-height: 126px;

    box-shadow:
        0 5px 14px rgba(0,0,0,0.04);
}

.feature-icon {
    font-size: 29px;
}

.feature-title {
    color: #17482e;

    font-weight: 900;

    margin-top: 6px;
}

.feature-text {
    color: #777;

    font-size: 13px;

    margin-top: 4px;
}


/* ==========================================================
   SECTION
   ========================================================== */

.section-heading {
    color: #123d27;

    font-size: 30px;

    font-weight: 900;

    margin-top: 15px;

    margin-bottom: 4px;
}

.section-subheading {
    color: #777;

    font-size: 15px;

    margin-bottom: 16px;
}


/* ==========================================================
   PUPPY IMAGE
   ========================================================== */

.puppy-image {
    border-radius: 15px;
    overflow: hidden;
}


/* ==========================================================
   PUPPY CARD
   ========================================================== */

.puppy-box {
    background: white;

    border: 1px solid #ddd9cf;

    border-radius: 18px;

    padding: 15px 15px 12px 15px;

    box-shadow:
        0 7px 18px rgba(0,0,0,0.06);

    margin-top: -4px;
}

.puppy-breed {
    color: #143f28;

    font-size: 20px;

    font-weight: 900;
}

.puppy-id {
    color: #7b7b7b;

    font-size: 13px;

    margin-top: 4px;
}

.puppy-line {
    color: #484848;

    font-size: 14px;

    margin-top: 8px;
}

.puppy-price {
    color: #18763c;

    font-size: 26px;

    font-weight: 900;

    margin-top: 10px;
}

.available-pill {
    display: inline-block;

    background: #e2f6e7;

    color: #22763d;

    border-radius: 50px;

    padding: 5px 10px;

    font-size: 13px;

    font-weight: 900;

    margin-top: 8px;
}


/* ==========================================================
   AI PANEL
   ========================================================== */

.ai-box {
    background: white;

    border: 1px solid #ddd9cf;

    border-radius: 20px;

    padding: 20px;

    box-shadow:
        0 7px 18px rgba(0,0,0,0.06);

    margin-bottom: 12px;
}

.ai-title {
    color: #123d27;

    font-size: 25px;

    font-weight: 900;
}

.ai-description {
    color: #777;

    font-size: 14px;

    margin-top: 3px;
}

.chat-user {
    background: #1d713b;

    color: white;

    border-radius: 14px 14px 4px 14px;

    padding: 10px 13px;

    margin: 9px 0 8px 25px;

    font-size: 14px;

    line-height: 1.5;
}

.chat-ai {
    background: #edf2ed;

    color: #303030;

    border-radius: 14px 14px 14px 4px;

    padding: 11px 13px;

    margin: 8px 25px 10px 0;

    font-size: 14px;

    line-height: 1.55;
}


/* ==========================================================
   TRUST BAR
   ========================================================== */

.trust-box {
    background: #eef5eb;

    border: 1px solid #d6e2d1;

    border-radius: 17px;

    padding: 20px 12px;

    text-align: center;

    margin-top: 25px;
}

.trust-title {
    color: #194a2f;

    font-size: 16px;

    font-weight: 900;
}

.trust-text {
    color: #707070;

    font-size: 13px;

    margin-top: 7px;
}


/* ==========================================================
   LEAD
   ========================================================== */

.lead-box {
    background: white;

    border: 1px solid #ddd9cf;

    border-radius: 18px;

    padding: 20px;

    margin-top: 22px;

    box-shadow:
        0 6px 16px rgba(0,0,0,0.05);
}


/* ==========================================================
   FOOTER
   ========================================================== */

.footer-box {
    background: #0d4529;

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

.footer-tagline {
    color: #e2bd61;

    font-size: 17px;

    font-style: italic;

    margin-top: 4px;
}

.footer-small {
    color: #d9e5dc;

    font-size: 14px;

    margin-top: 8px;
}


/* ==========================================================
   BUTTONS
   ========================================================== */

.stButton > button {
    width: 100%;

    min-height: 42px;

    border-radius: 10px;

    border: none;

    background: #b8892d;

    color: white;

    font-weight: 900;
}

.stButton > button:hover {
    background: #956d20;

    color: white;
}

.stFormSubmitButton > button {
    border-radius: 10px;
    font-weight: 800;
}

</style>
""",
    unsafe_allow_html=True,
)


# ============================================================
# LOGO
# ============================================================

def crop_logo(image):
    """
    Crops large uniform whitespace from the supplied logo.
    Keeps the existing image; does not alter the source file.
    """

    try:

        image = image.convert("RGB")

        background = Image.new(
            "RGB",
            image.size,
            image.getpixel((0, 0))
        )

        difference = ImageChops.difference(
            image,
            background
        )

        difference = ImageOps.grayscale(
            difference
        )

        bbox = difference.getbbox()

        if bbox:
            image = image.crop(bbox)

        return image

    except Exception:
        return image


# ============================================================
# BRAND HEADER
# ============================================================

if os.path.isfile(LOGO_FILE):

    try:

        logo = Image.open(
            LOGO_FILE
        )

        logo = crop_logo(
            logo
        )

        st.html(
            '<div class="brand-area">'
        )

        st.image(
            logo,
            width=430
        )

        st.html(
            """
            <div class="brand-subtitle">
                PETS BEYOND BORDERS
            </div>

            <div class="brand-tagline">
                More Pets. A Wilder World.
            </div>

            </div>
            """
        )

    except Exception:

        st.html(
            """
            <div class="brand-area">

                <div style="
                    color:#123d27;
                    font-size:45px;
                    font-weight:900;
                ">
                    PETORA™
                </div>

                <div class="brand-subtitle">
                    PETS BEYOND BORDERS
                </div>

                <div class="brand-tagline">
                    More Pets. A Wilder World.
                </div>

            </div>
            """
        )

else:

    st.html(
        """
        <div class="brand-area">

            <div style="
                color:#123d27;
                font-size:45px;
                font-weight:900;
            ">
                PETORA™
            </div>

            <div class="brand-subtitle">
                PETS BEYOND BORDERS
            </div>

            <div class="brand-tagline">
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
    <div class="nav-bar">

        🏠 Home
        &nbsp; | &nbsp;

        🐶 Dogs
        &nbsp; | &nbsp;

        🐱 Cats
        &nbsp; | &nbsp;

        🐟 Aquatics
        &nbsp; | &nbsp;

        🐍 Reptiles
        &nbsp; | &nbsp;

        🦜 Exotic Pets
        &nbsp; | &nbsp;

        🤖 AI Assistant
        &nbsp; | &nbsp;

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
        "Answers from your business data."
    ),
]

feature_columns = st.columns(4)

for column, item in zip(
    feature_columns,
    feature_data
):

    icon, title, description = item

    with column:

        st.html(
            f"""
            <div class="feature-box">

                <div class="feature-icon">
                    {icon}
                </div>

                <div class="feature-title">
                    {title}
                </div>

                <div class="feature-text">
                    {description}
                </div>

            </div>
            """
        )


# ============================================================
# INVENTORY
# ============================================================

@st.cache_data
def load_inventory():

    if not os.path.isfile(
        PUPPY_FILE
    ):
        return pd.DataFrame()

    try:

        df = pd.read_csv(
            PUPPY_FILE
        )

        return df

    except Exception:

        return pd.DataFrame()


inventory = load_inventory()


if inventory.empty:

    st.error(
        "Could not load data/puppies.csv"
    )

    st.stop()


# ============================================================
# ENSURE COLUMNS
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

    if not os.path.isfile(
        KNOWLEDGE_FILE
    ):
        return []

    try:

        with open(
            KNOWLEDGE_FILE,
            "r",
            encoding="utf-8"
        ) as file:

            content = file.read()

    except Exception:

        return []


    chunks = [
        chunk.strip()
        for chunk in re.split(
            r"[\n.!?]+",
            content
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
# ENQUIRIES
# ============================================================

def ensure_enquiry_file():

    if not os.path.isfile(
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

        return match.group(
            0
        ).upper()

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

    text = text.lower()

    return any(
        keyword in text
        for keyword in keywords
    )


def make_inventory_context():

    return (
        "CURRENT PET INVENTORY:\n\n"
        + inventory.to_string(
            index=False
        )
    )


def make_rag_context(query):

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

        return make_inventory_context()


    if (
        knowledge_embeddings is None
        or not knowledge_chunks
    ):

        return ""


    query_vector = (
        embedding_model.encode(
            [query]
        )
    )


    scores = cosine_similarity(
        query_vector,
        knowledge_embeddings
    )[0]


    top_indices = (
        scores.argsort()[
            -4:
        ][::-1]
    )


    return "\n".join(
        knowledge_chunks[i]
        for i in top_indices
    )


# ============================================================
# SESSION STATE
# ============================================================

if "messages" not in st.session_state:

    st.session_state.messages = []


if "lead_request" not in st.session_state:

    st.session_state.lead_request = None


# ============================================================
# MAIN LAYOUT
# ============================================================

left_column, right_column = st.columns(
    [1.7, 1],
    gap="large"
)


# ============================================================
# LEFT COLUMN — PUPPIES
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

        puppy_columns = st.columns(
            min(
                3,
                len(available)
            )
        )


        for index, (_, puppy) in enumerate(
            available.iterrows()
        ):

            with puppy_columns[
                index % len(puppy_columns)
            ]:

                # ------------------------------------------------
                # IMAGE
                # ------------------------------------------------

                photo_name = str(
                    puppy["photo"]
                ).strip().lstrip("/")


                image_path = os.path.join(
                    BASE_DIR,
                    photo_name
                )


                if (
                    photo_name
                    and os.path.isfile(
                        image_path
                    )
                ):

                    try:

                        puppy_image = Image.open(
                            image_path
                        ).convert(
                            "RGB"
                        )


                        # Same displayed dimensions for all
                        # puppy images.
                        puppy_image = ImageOps.fit(
                            puppy_image,
                            (600, 450),
                            method=Image.Resampling.LANCZOS,
                            centering=(0.5, 0.5)
                        )


                        st.image(
                            puppy_image,
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


                # ------------------------------------------------
                # CARD INFORMATION
                # ------------------------------------------------

                safe_breed = html.escape(
                    str(
                        puppy["breed"]
                    )
                )

                safe_id = html.escape(
                    str(
                        puppy["puppy_id"]
                    )
                )

                safe_gender = html.escape(
                    str(
                        puppy["gender"]
                    )
                )

                safe_vaccinated = html.escape(
                    str(
                        puppy["vaccinated"]
                    )
                )

                safe_location = html.escape(
                    str(
                        puppy["location"]
                    )
                )


                st.html(
                    f"""
                    <div class="puppy-box">

                        <div class="puppy-breed">
                            🐶 {safe_breed}
                        </div>

                        <div class="puppy-id">
                            Puppy ID:
                            <b>{safe_id}</b>
                        </div>

                        <div class="puppy-line">
                            Gender:
                            <b>{safe_gender}</b>
                        </div>

                        <div class="puppy-line">
                            Age:
                            <b>{int(puppy["age_weeks"])} weeks</b>
                        </div>

                        <div class="puppy-price">
                            ₹{puppy["price"]:,.0f}
                        </div>

                        <span class="available-pill">
                            ✓ Available
                        </span>

                        <div class="puppy-line">
                            Vaccinated:
                            <b>{safe_vaccinated}</b>
                        </div>

                        <div class="puppy-line">
                            Location:
                            <b>{safe_location}</b>
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
# RIGHT COLUMN — AI
# ============================================================

with right_column:

    st.html(
        """
        <div class="ai-box">

            <div class="ai-title">
                🤖 PETORA AI Assistant
            </div>

            <div class="ai-description">
                Ask about puppies, prices, availability,
                breeds or pet care.
            </div>

        </div>
        """
    )


    # --------------------------------------------------------
    # CHAT HISTORY
    # --------------------------------------------------------

    for message in st.session_state.messages:

        if message["role"] == "user":

            safe_message = html.escape(
                str(
                    message["content"]
                )
            )

            st.html(
                f"""
                <div class="chat-user">
                    {safe_message}
                </div>
                """
            )

        else:

            safe_message = (
                html.escape(
                    str(
                        message["content"]
                    )
                )
                .replace(
                    "\n",
                    "<br>"
                )
            )

            st.html(
                f"""
                <div class="chat-ai">
                    {safe_message}
                </div>
                """
            )


    # --------------------------------------------------------
    # CHAT FORM
    # --------------------------------------------------------

    with st.form(
        "petora_chat_form",
        clear_on_submit=True
    ):

        query = st.text_input(
            "Ask PETORA AI",
            placeholder=(
                "Ask about puppies, prices "
                "or availability..."
            ),
            label_visibility="collapsed"
        )


        ask_button = st.form_submit_button(
            "➤ Ask PETORA"
        )


    # --------------------------------------------------------
    # PROCESS QUESTION
    # --------------------------------------------------------

    if ask_button and query.strip():

        query = query.strip()


        # ----------------------------------------------------
        # STORE USER MESSAGE
        # ----------------------------------------------------

        st.session_state.messages.append(
            {
                "role": "user",
                "content": query
            }
        )


        # ----------------------------------------------------
        # FIND PUPPY ID
        # ----------------------------------------------------

        puppy_id = find_puppy_id(
            query
        )

        puppy = find_puppy(
            puppy_id
        )


        # ----------------------------------------------------
        # BUYING INTENT
        # ----------------------------------------------------

        if detect_buying_intent(
            query
        ):

            st.session_state.lead_request = {
                "puppy_id": puppy_id,
                "message": query
            }


        # ----------------------------------------------------
        # EXACT PUPPY ANSWER
        # ----------------------------------------------------

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
                    f"Breed: {puppy['breed']}\n\n"
                    f"Gender: {puppy['gender']}\n\n"
                    f"Age: {int(puppy['age_weeks'])} weeks\n\n"
                    f"Price: ₹{puppy['price']:,.0f}\n\n"
                    f"Vaccinated: {puppy['vaccinated']}\n\n"
                    f"Location: {puppy['location']}"
                )

            else:

                answer = (
                    f"{puppy_id} is currently "
                    f"{str(puppy['status']).lower()}."
                )


        else:

            # ------------------------------------------------
            # RAG
            # ------------------------------------------------

            context = make_rag_context(
                query
            )


            # ------------------------------------------------
            # HUGGING FACE TOKEN
            # ------------------------------------------------

            try:

                hf_token = st.secrets[
                    "HF_TOKEN"
                ]

            except Exception:

                hf_token = None


            if not hf_token:

                answer = (
                    "PETORA AI is not configured.\n\n"
                    "Please add HF_TOKEN to your "
                    "Streamlit Secrets."
                )

            else:

                # ------------------------------------------------
                # HUGGING FACE INFERENCE PROVIDERS
                # ------------------------------------------------

                try:

                    client = InferenceClient(
                        api_key=hf_token,
                        provider="auto"
                    )


                    response = (
                        client.chat.completions.create(
                            model=HF_MODEL,
                            messages=[
                                {
                                    "role": "system",
                                    "content": (
                                        "You are PETORA AI "
                                        "Assistant for a pet "
                                        "business.\n\n"

                                        "Use ONLY the supplied "
                                        "context.\n\n"

                                        "Never invent puppy "
                                        "prices, breeds, ages, "
                                        "availability, "
                                        "vaccination information "
                                        "or locations.\n\n"

                                        "If the answer is not in "
                                        "the context, say exactly "
                                        "that you do not know "
                                        "based on the available "
                                        "information.\n\n"

                                        "Keep answers concise, "
                                        "helpful and suitable "
                                        "for customers."
                                    )
                                },
                                {
                                    "role": "user",
                                    "content": (
                                        "Context:\n\n"
                                        f"{context}\n\n"
                                        "Customer question:\n\n"
                                        f"{query}"
                                    )
                                }
                            ],
                            max_tokens=300,
                            temperature=0.2
                        )
                    )


                    answer = (
                        response
                        .choices[0]
                        .message
                        .content
                    )


                except Exception as error:

                    # Do NOT expose the token.
                    answer = (
                        "⚠️ PETORA AI could not complete "
                        "the request right now.\n\n"
                        f"Model: {HF_MODEL}\n"
                        f"Error: {type(error).__name__}: "
                        f"{error}"
                    )


        # ----------------------------------------------------
        # STORE AI MESSAGE
        # ----------------------------------------------------

        st.session_state.messages.append(
            {
                "role": "assistant",
                "content": answer
            }
        )


        st.rerun()


# ============================================================
# LEAD CAPTURE
# ============================================================

if st.session_state.lead_request:

    st.divider()


    st.html(
        """
        <div class="lead-box">

            <div class="section-heading">
                📞 Interested in a Puppy?
            </div>

        </div>
        """
    )


    lead_puppy_id = (
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
        lead_puppy_id
    )


    if lead_puppy is not None:

        lead_breed = str(
            lead_puppy["breed"]
        )

        st.write(
            f"Enquiry for **{lead_puppy_id} "
            f"({lead_breed})**"
        )

    else:

        lead_breed = ""

        st.write(
            "Please specify which puppy you are interested in."
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

        submitted = st.form_submit_button(
            "📩 Submit Enquiry"
        )


        if submitted:

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
                    lead_puppy_id,
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
    <div class="trust-box">

        <div class="trust-title">
            🐾 Wide Range of Pets
            &nbsp; • &nbsp;
            🌿 Ethical & Responsible
            &nbsp; • &nbsp;
            🚚 Pan India
            &nbsp; • &nbsp;
            ❤️ Support & Guidance
        </div>

        <div class="trust-text">
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
    <div class="footer-box">

        <div class="footer-brand">
            PETORA™
        </div>

        <div class="footer-tagline">
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