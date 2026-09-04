import os
import re
from datetime import datetime

import pandas as pd
import streamlit as st

from PIL import Image, ImageOps
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from huggingface_hub import InferenceClient


# =========================================================
# PAGE CONFIG
# =========================================================

st.set_page_config(
    page_title="PETORA | Pets Beyond Borders",
    page_icon="🐾",
    layout="wide",
    initial_sidebar_state="collapsed"
)


# =========================================================
# PROJECT PATHS
# =========================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DATA_DIR = os.path.join(BASE_DIR, "data")
IMAGE_DIR = os.path.join(BASE_DIR, "images")

PUPPY_FILE = os.path.join(DATA_DIR, "puppies.csv")
KNOWLEDGE_FILE = os.path.join(DATA_DIR, "info.text")
ENQUIRY_FILE = os.path.join(DATA_DIR, "enquiries.csv")

LOGO_FILE = os.path.join(
    IMAGE_DIR,
    "petora-logo.png"
)


# =========================================================
# CUSTOM CSS
# =========================================================

st.markdown(
    """
    <style>

    /* =========================
       GLOBAL
       ========================= */

    .stApp {
        background: #fbfaf5;
    }

    .block-container {
        max-width: 1400px;
        padding-top: 1rem;
        padding-bottom: 2rem;
    }

    /* =========================
       BRAND HEADER
       ========================= */

    .brand-header {
        background: linear-gradient(
            135deg,
            #f4f0e3,
            #ffffff,
            #edf4eb
        );
        border-radius: 22px;
        padding: 15px 20px 10px 20px;
        border: 1px solid #ddd8c8;
        box-shadow: 0 6px 18px rgba(0,0,0,0.05);
        text-align: center;
        margin-bottom: 12px;
    }

    .brand-logo {
        display: block;
        margin: 0 auto;
        max-width: 430px;
    }

    .brand-subtitle {
        color: #a07a24;
        font-size: 17px;
        font-weight: 700;
        letter-spacing: 1px;
        margin-top: 2px;
    }

    .brand-tagline {
        color: #214d34;
        font-size: 16px;
        font-style: italic;
        margin-top: 3px;
    }

    /* =========================
       NAVIGATION
       ========================= */

    .nav-bar {
        background: #0f4429;
        color: white;
        border-radius: 15px;
        padding: 14px 10px;
        text-align: center;
        font-weight: 600;
        margin: 10px 0 22px 0;
        box-shadow: 0 5px 14px rgba(15,68,41,0.18);
    }

    /* =========================
       HERO
       ========================= */

    .hero {
        background:
            linear-gradient(
                110deg,
                #f8f4e9 0%,
                #ffffff 55%,
                #eaf2e7 100%
            );
        border: 1px solid #ded8c8;
        border-radius: 22px;
        padding: 34px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.06);
        margin-bottom: 25px;
    }

    .hero-kicker {
        color: #a07a24;
        font-size: 15px;
        font-weight: 800;
        letter-spacing: 2px;
        text-transform: uppercase;
    }

    .hero-title {
        color: #123d27;
        font-size: 42px;
        font-weight: 800;
        margin-top: 6px;
        margin-bottom: 6px;
    }

    .hero-text {
        color: #505050;
        font-size: 18px;
        line-height: 1.6;
        max-width: 900px;
    }

    /* =========================
       FEATURES
       ========================= */

    .feature-box {
        background: white;
        border-radius: 15px;
        border: 1px solid #e2dfd6;
        padding: 16px;
        text-align: center;
        height: 100%;
        box-shadow: 0 4px 12px rgba(0,0,0,0.04);
    }

    .feature-icon {
        font-size: 30px;
    }

    .feature-title {
        font-weight: 700;
        color: #173f29;
        margin-top: 4px;
    }

    .feature-text {
        color: #777;
        font-size: 14px;
    }

    /* =========================
       SECTION TITLES
       ========================= */

    .section-title {
        color: #173f29;
        font-size: 29px;
        font-weight: 800;
        margin: 12px 0 4px 0;
    }

    .section-subtitle {
        color: #777;
        margin-bottom: 16px;
    }

    /* =========================
       PUPPY CARDS
       ========================= */

    .puppy-card {
        background: white;
        border-radius: 18px;
        border: 1px solid #dedbd1;
        overflow: hidden;
        box-shadow: 0 7px 20px rgba(0,0,0,0.06);
        margin-bottom: 16px;
    }

    .puppy-details {
        padding: 16px 16px 18px 16px;
    }

    .puppy-breed {
        color: #163c26;
        font-size: 22px;
        font-weight: 800;
        margin-bottom: 8px;
    }

    .puppy-id {
        color: #777;
        font-size: 14px;
        margin-bottom: 10px;
    }

    .puppy-price {
        color: #176334;
        font-size: 26px;
        font-weight: 800;
        margin: 10px 0;
    }

    .available-badge {
        display: inline-block;
        background: #e5f7e9;
        color: #1b7b3b;
        border-radius: 50px;
        padding: 6px 11px;
        font-weight: 700;
        font-size: 13px;
    }

    /* =========================
       AI CARD
       ========================= */

    .ai-panel {
        background: white;
        border: 1px solid #dcd8cb;
        border-radius: 20px;
        padding: 20px;
        box-shadow: 0 7px 20px rgba(0,0,0,0.06);
    }

    .ai-header {
        color: #123d27;
        font-size: 24px;
        font-weight: 800;
    }

    .ai-subtitle {
        color: #777;
        font-size: 14px;
        margin-bottom: 12px;
    }

    /* =========================
       TRUST BAR
       ========================= */

    .trust-box {
        background: #f0f5ed;
        border: 1px solid #d9e3d3;
        border-radius: 18px;
        padding: 18px 10px;
        text-align: center;
        margin-top: 22px;
    }

    .trust-title {
        color: #173f29;
        font-weight: 800;
    }

    .trust-text {
        color: #666;
        font-size: 14px;
    }

    /* =========================
       FOOTER
       ========================= */

    .footer {
        background: #0f4429;
        color: white;
        border-radius: 18px;
        padding: 28px;
        text-align: center;
        margin-top: 30px;
    }

    .footer-brand {
        font-size: 28px;
        font-weight: 800;
    }

    .footer-tagline {
        color: #e4bf63;
        font-size: 17px;
        font-style: italic;
        margin-top: 5px;
    }

    .footer-links {
        margin-top: 10px;
        color: #dbe8de;
        font-size: 14px;
    }

    /* =========================
       STREAMLIT BUTTONS
       ========================= */

    .stButton > button {
        width: 100%;
        border-radius: 10px;
        border: none;
        background: #b98b2f;
        color: white;
        font-weight: 700;
        min-height: 42px;
    }

    .stButton > button:hover {
        background: #986f20;
        color: white;
    }

    </style>
    """,
    unsafe_allow_html=True
)


# =========================================================
# LOGO
# =========================================================

st.markdown(
    '<div class="brand-header">',
    unsafe_allow_html=True
)

if os.path.exists(LOGO_FILE):

    logo = Image.open(
        LOGO_FILE
    ).convert("RGB")

    st.image(
        logo,
        width=430
    )

else:

    st.markdown(
        """
        <div style="
            font-size:44px;
            font-weight:800;
            color:#123d27;
        ">
        PETORA™
        </div>
        """,
        unsafe_allow_html=True
    )

st.markdown(
    """
    <div class="brand-subtitle">
    PETS BEYOND BORDERS
    </div>

    <div class="brand-tagline">
    More Pets. A Wilder World.
    </div>
    """,
    unsafe_allow_html=True
)

st.markdown(
    '</div>',
    unsafe_allow_html=True
)


# =========================================================
# NAVIGATION
# =========================================================

st.markdown(
    """
    <div class="nav-bar">
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
    """,
    unsafe_allow_html=True
)


# =========================================================
# HERO
# =========================================================

st.markdown(
    """
    <div class="hero">

        <div class="hero-kicker">
        Welcome to PETORA
        </div>

        <div class="hero-title">
        Your Complete Pet Companion
        </div>

        <div class="hero-text">
        Find puppies, explore pets, check availability,
        ask PETORA AI questions and start your pet journey
        with confidence.
        </div>

    </div>
    """,
    unsafe_allow_html=True
)


# =========================================================
# FEATURE BOXES
# =========================================================

feature_cols = st.columns(4)

features = [
    ("🔎", "Browse", "Explore available pets."),
    ("🤖", "Ask PETORA AI", "Get instant answers."),
    ("📞", "Enquire", "Contact us about a pet."),
    ("❤️", "Pet Care", "Healthy and responsible pet ownership.")
]

for col, feature in zip(
    feature_cols,
    features
):

    icon, title, text = feature

    with col:

        st.markdown(
            f"""
            <div class="feature-box">

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
            """,
            unsafe_allow_html=True
        )


st.markdown("<br>", unsafe_allow_html=True)


# =========================================================
# EMBEDDING MODEL
# =========================================================

@st.cache_resource
def load_embedding_model():

    return SentenceTransformer(
        "all-MiniLM-L6-v2"
    )


model = load_embedding_model()


# =========================================================
# KNOWLEDGE BASE
# =========================================================

@st.cache_data
def load_knowledge():

    if not os.path.exists(
        KNOWLEDGE_FILE
    ):

        return []

    with open(
        KNOWLEDGE_FILE,
        "r",
        encoding="utf-8"
    ) as file:

        content = file.read()

    chunks = [
        chunk.strip()
        for chunk in content.split(".")
        if chunk.strip()
    ]

    return chunks


chunks = load_knowledge()


if chunks:

    knowledge_embeddings = model.encode(
        chunks
    )

else:

    knowledge_embeddings = None


# =========================================================
# INVENTORY
# =========================================================

@st.cache_data
def load_inventory():

    if not os.path.exists(
        PUPPY_FILE
    ):

        return pd.DataFrame()

    return pd.read_csv(
        PUPPY_FILE
    )


inventory = load_inventory()


if inventory.empty:

    st.error(
        "Unable to load puppy inventory."
    )

    st.stop()


# =========================================================
# REQUIRED COLUMNS
# =========================================================

required_columns = [
    "puppy_id",
    "breed",
    "gender",
    "age_weeks",
    "price",
    "status",
    "vaccinated",
    "location",
    "photo"
]


for column in required_columns:

    if column not in inventory.columns:

        inventory[column] = ""


# =========================================================
# CLEAN DATA
# =========================================================

for column in [
    "puppy_id",
    "breed",
    "gender",
    "status",
    "vaccinated",
    "location",
    "photo"
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


# =========================================================
# ENQUIRY STORAGE
# =========================================================

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
                "status"
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
                "status": "New"
            }
        ]
    )

    row.to_csv(
        ENQUIRY_FILE,
        mode="a",
        header=False,
        index=False
    )


# =========================================================
# UTILITY FUNCTIONS
# =========================================================

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

    if len(result):

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
        "i would like"
    ]

    text = text.lower()

    return any(
        keyword in text
        for keyword in keywords
    )


# =========================================================
# SESSION STATE
# =========================================================

if "messages" not in st.session_state:

    st.session_state.messages = []


if "lead_request" not in st.session_state:

    st.session_state.lead_request = None


# =========================================================
# MAIN CONTENT
# =========================================================

available = inventory[
    inventory["status"]
    .str.lower()
    .eq("available")
].copy()


st.markdown(
    '<div class="section-title">🐾 Available Puppies</div>',
    unsafe_allow_html=True
)

st.markdown(
    '<div class="section-subtitle">'
    'Browse our current puppy inventory and contact us directly.'
    '</div>',
    unsafe_allow_html=True
)


# =========================================================
# PUPPY + AI LAYOUT
# =========================================================

left_column, right_column = st.columns(
    [1.65, 1],
    gap="large"
)


# =========================================================
# LEFT: PUPPIES
# =========================================================

with left_column:

    if available.empty:

        st.info(
            "No puppies are currently available."
        )

    else:

        puppy_columns = st.columns(
            min(3, len(available))
        )

        for i, (_, puppy) in enumerate(
            available.iterrows()
        ):

            with puppy_columns[
                i % len(puppy_columns)
            ]:

                photo_name = str(
                    puppy["photo"]
                ).strip()

                photo_name = photo_name.lstrip(
                    "/"
                )


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

                    placeholder = Image.new(
                        "RGB",
                        (600, 450),
                        "#e9e9e9"
                    )

                    st.image(
                        placeholder,
                        width="stretch"
                    )


                st.markdown(
                    f"""
                    <div class="puppy-details">

                        <div class="puppy-breed">
                        🐶 {puppy['breed']}
                        </div>

                        <div class="puppy-id">
                        Puppy ID: {puppy['puppy_id']}
                        </div>

                    </div>
                    """,
                    unsafe_allow_html=True
                )


                st.write(
                    f"**Gender:** {puppy['gender']}"
                )

                st.write(
                    f"**Age:** "
                    f"{int(puppy['age_weeks'])} weeks"
                )

                st.markdown(
                    f"""
                    <div class="puppy-price">
                    ₹{puppy['price']:,.0f}
                    </div>
                    """,
                    unsafe_allow_html=True
                )

                st.markdown(
                    """
                    <span class="available-badge">
                    ✓ Available
                    </span>
                    """,
                    unsafe_allow_html=True
                )

                st.write(
                    f"Vaccinated: "
                    f"{puppy['vaccinated']}"
                )

                st.write(
                    f"Location: "
                    f"{puppy['location']}"
                )


                if st.button(
                    "📞 I'm Interested",
                    key=f"interest_{puppy['puppy_id']}"
                ):

                    st.session_state.lead_request = {
                        "puppy_id": str(
                            puppy["puppy_id"]
                        ),
                        "message": (
                            "Customer is interested in "
                            f"{puppy['puppy_id']}"
                        )
                    }

                    st.rerun()


# =========================================================
# RIGHT: AI ASSISTANT
# =========================================================

with right_column:

    st.markdown(
        """
        <div class="ai-panel">

            <div class="ai-header">
            🤖 PETORA AI Assistant
            </div>

            <div class="ai-subtitle">
            Ask about puppies, prices, availability,
            breeds or pet care.
            </div>

        </div>
        """,
        unsafe_allow_html=True
    )


    # ---------------------------------------------
    # CHAT HISTORY
    # ---------------------------------------------

    for message in st.session_state.messages:

        with st.chat_message(
            message["role"]
        ):

            st.markdown(
                message["content"]
            )


    # ---------------------------------------------
    # CHAT INPUT
    # ---------------------------------------------

    query = st.chat_input(
        "Ask PETORA AI..."
    )


    if query:

        st.session_state.messages.append(
            {
                "role": "user",
                "content": query
            }
        )


        with st.chat_message(
            "user"
        ):

            st.write(
                query
            )


        puppy_id = find_puppy_id(
            query
        )

        puppy = find_puppy(
            puppy_id
        )


        if detect_buying_intent(
            query
        ):

            st.session_state.lead_request = {
                "puppy_id": puppy_id,
                "message": query
            }


        # -----------------------------------------
        # EXACT PUPPY LOOKUP
        # -----------------------------------------

        if (
            puppy_id
            and puppy is not None
        ):

            if str(
                puppy["status"]
            ).lower() == "available":

                answer = (
                    f"**{puppy_id} is available.**\n\n"
                    f"Breed: {puppy['breed']}\n\n"
                    f"Gender: {puppy['gender']}\n\n"
                    f"Age: {int(puppy['age_weeks'])} weeks\n\n"
                    f"Price: ₹{puppy['price']:,.0f}\n\n"
                    f"Vaccinated: {puppy['vaccinated']}\n\n"
                    f"Location: {puppy['location']}"
                )

            else:

                answer = (
                    f"**{puppy_id}** is currently "
                    f"{puppy['status'].lower()}."
                )


        else:

            # -----------------------------------------
            # CONTEXT
            # -----------------------------------------

            keywords = [
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
                "location"
            ]


            if any(
                word in query.lower()
                for word in keywords
            ):

                context = (
                    "Current puppy inventory:\n\n"
                    + inventory.to_string(
                        index=False
                    )
                )

            elif knowledge_embeddings is not None:

                query_embedding = model.encode(
                    [query]
                )

                similarities = cosine_similarity(
                    query_embedding,
                    knowledge_embeddings
                )[0]

                top_indices = similarities.argsort()[
                    -3:
                ][::-1]

                context = "\n".join(
                    chunks[index]
                    for index in top_indices
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

                client = InferenceClient(
                    api_key=hf_token,
                    provider="auto"
                )


                completion = (
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
                                    "Assistant. Use ONLY "
                                    "the provided context. "
                                    "Never invent prices, "
                                    "availability, breeds, "
                                    "ages or vaccination "
                                    "records. If the "
                                    "information is not "
                                    "available, say: "
                                    "'I don't know based "
                                    "on the available "
                                    "information.'"
                                )
                            },
                            {
                                "role": "user",
                                "content": f"""
Context:

{context}

Question:

{query}
"""
                            }
                        ],
                        max_tokens=250,
                        temperature=0.2
                    )
                )


                answer = (
                    completion
                    .choices[0]
                    .message
                    .content
                )


            except Exception:

                answer = (
                    "PETORA AI is temporarily "
                    "unavailable. Please try again "
                    "in a moment."
                )


        with st.chat_message(
            "assistant"
        ):

            st.markdown(
                answer
            )


        st.session_state.messages.append(
            {
                "role": "assistant",
                "content": answer
            }
        )


# =========================================================
# LEAD CAPTURE
# =========================================================

if st.session_state.lead_request:

    st.divider()

    st.markdown(
        '<div class="section-title">'
        '📞 Interested in a Puppy?'
        '</div>',
        unsafe_allow_html=True
    )


    puppy_id = (
        st.session_state.lead_request[
            "puppy_id"
        ]
    )

    original_message = (
        st.session_state.lead_request[
            "message"
        ]
    )

    puppy = find_puppy(
        puppy_id
    )


    if puppy is not None:

        breed = str(
            puppy["breed"]
        )

        st.write(
            f"Enquiry for **{puppy_id} "
            f"({breed})**"
        )

    else:

        breed = ""

        st.write(
            "Please specify the puppy you want."
        )


    with st.form(
        "lead_capture"
    ):

        name = st.text_input(
            "Your Name"
        )

        phone = st.text_input(
            "Phone Number"
        )

        submitted = st.form_submit_button(
            "Submit Enquiry"
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
                    puppy_id,
                    breed,
                    original_message
                )

                st.success(
                    "✅ Your enquiry has been submitted!"
                )

                st.session_state.lead_request = None

                st.rerun()


# =========================================================
# TRUST BAR
# =========================================================

st.markdown(
    """
    <div class="trust-box">

        <div class="trust-title">
        🐾 Wide Range of Pets
        &nbsp;&nbsp;&nbsp; | &nbsp;&nbsp;&nbsp;
        🌿 Ethical & Responsible
        &nbsp;&nbsp;&nbsp; | &nbsp;&nbsp;&nbsp;
        🚚 Pan India
        &nbsp;&nbsp;&nbsp; | &nbsp;&nbsp;&nbsp;
        ❤️ Support & Guidance
        </div>

        <div class="trust-text">
        PETORA is designed to grow from puppies
        into a broader pet marketplace.
        </div>

    </div>
    """,
    unsafe_allow_html=True
)


# =========================================================
# FOOTER
# =========================================================

st.markdown(
    """
    <div class="footer">

        <div class="footer-brand">
        PETORA™
        </div>

        <div class="footer-tagline">
        More Pets. A Wilder World.
        </div>

        <div class="footer-links">
        Dogs • Cats • Aquatics • Reptiles • Exotic Pets
        </div>

        <div style="margin-top:14px;">
        🐾 Care &nbsp; • &nbsp;
        🌿 Trust &nbsp; • &nbsp;
        ❤️ Passion &nbsp; • &nbsp;
        🌍 For Every Species
        </div>

    </div>
    """,
    unsafe_allow_html=True
)