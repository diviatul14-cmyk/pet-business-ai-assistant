import os
import re
from datetime import datetime

import pandas as pd
import streamlit as st
from PIL import Image, ImageOps
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
# CUSTOM STYLE
# ============================================================

st.markdown(
    """
    <style>

    /* ---------- PAGE ---------- */

    .stApp {
        background: #faf9f4;
    }

    .block-container {
        max-width: 1400px;
        padding-top: 1rem;
        padding-bottom: 2rem;
    }

    /* ---------- BRAND AREA ---------- */

    .brand-area {
        background: linear-gradient(
            135deg,
            #f3efe2,
            #ffffff,
            #edf4ea
        );
        border: 1px solid #ded8c8;
        border-radius: 22px;
        padding: 18px 20px;
        text-align: center;
        margin-bottom: 12px;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.05);
    }

    .brand-name {
        color: #123d27;
        font-size: 46px;
        font-weight: 900;
        letter-spacing: 1px;
        margin: 0;
    }

    .brand-subtitle {
        color: #9a731d;
        font-size: 16px;
        font-weight: 800;
        letter-spacing: 3px;
        margin-top: 3px;
    }

    .brand-tagline {
        color: #345b43;
        font-size: 16px;
        font-style: italic;
        margin-top: 4px;
    }

    /* ---------- NAV ---------- */

    .nav-bar {
        background: #0e4428;
        color: white;
        border-radius: 13px;
        padding: 14px 12px;
        text-align: center;
        font-weight: 700;
        margin-bottom: 24px;
        box-shadow: 0 5px 14px rgba(14, 68, 40, 0.18);
    }

    /* ---------- HERO ---------- */

    .hero-box {
        background: linear-gradient(
            110deg,
            #f7f3e7,
            #ffffff 55%,
            #edf4e9
        );
        border: 1px solid #dfdacb;
        border-radius: 22px;
        padding: 30px;
        margin-bottom: 22px;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.05);
    }

    .hero-kicker {
        color: #a1781e;
        font-size: 14px;
        font-weight: 900;
        letter-spacing: 2px;
        text-transform: uppercase;
    }

    .hero-title {
        color: #123d27;
        font-size: 42px;
        font-weight: 900;
        margin-top: 5px;
        margin-bottom: 8px;
    }

    .hero-description {
        color: #555555;
        font-size: 18px;
        line-height: 1.6;
    }

    /* ---------- SECTION ---------- */

    .section-title {
        color: #123d27;
        font-size: 30px;
        font-weight: 900;
        margin-top: 14px;
        margin-bottom: 3px;
    }

    .section-description {
        color: #707070;
        font-size: 15px;
        margin-bottom: 16px;
    }

    /* ---------- FEATURE BOX ---------- */

    .feature-box {
        background: white;
        border: 1px solid #e2ded4;
        border-radius: 16px;
        padding: 18px 12px;
        text-align: center;
        min-height: 135px;
        box-shadow: 0 5px 14px rgba(0, 0, 0, 0.04);
    }

    .feature-icon {
        font-size: 28px;
    }

    .feature-title {
        color: #17482e;
        font-weight: 800;
        margin-top: 6px;
    }

    .feature-description {
        color: #777777;
        font-size: 14px;
    }

    /* ---------- AI PANEL ---------- */

    .ai-panel {
        background: white;
        border: 1px solid #ddd8cc;
        border-radius: 20px;
        padding: 20px;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.05);
        margin-bottom: 16px;
    }

    .ai-title {
        color: #123d27;
        font-size: 25px;
        font-weight: 900;
    }

    .ai-description {
        color: #777777;
        font-size: 14px;
    }

    /* ---------- INFO / TRUST ---------- */

    .trust-box {
        background: #eff5ec;
        border: 1px solid #d8e3d3;
        border-radius: 18px;
        padding: 20px 14px;
        text-align: center;
        margin-top: 28px;
    }

    .trust-title {
        color: #17482e;
        font-size: 17px;
        font-weight: 800;
    }

    .trust-text {
        color: #6b6b6b;
        font-size: 14px;
        margin-top: 6px;
    }

    /* ---------- FOOTER ---------- */

    .footer-box {
        background: #0e4428;
        color: white;
        border-radius: 18px;
        padding: 28px 18px;
        text-align: center;
        margin-top: 30px;
    }

    .footer-brand {
        font-size: 28px;
        font-weight: 900;
    }

    .footer-tagline {
        color: #e1bb5f;
        font-size: 17px;
        font-style: italic;
        margin-top: 4px;
    }

    .footer-links {
        color: #dbe8dd;
        margin-top: 9px;
        font-size: 14px;
    }

    /* ---------- BUTTONS ---------- */

    .stButton > button {
        width: 100%;
        min-height: 42px;
        border-radius: 10px;
        border: none;
        font-weight: 800;
        background: #b8892d;
        color: white;
    }

    .stButton > button:hover {
        background: #966d20;
        color: white;
    }

    </style>
    """,
    unsafe_allow_html=True,
)


# ============================================================
# LOAD LOGO
# ============================================================

def load_logo():
    if not os.path.exists(LOGO_FILE):
        return None

    try:
        return Image.open(LOGO_FILE).convert("RGB")
    except Exception:
        return None


logo = load_logo()


# ============================================================
# BRAND HEADER
# ============================================================

st.markdown('<div class="brand-area">', unsafe_allow_html=True)

if logo is not None:
    st.image(logo, width=430)
else:
    st.markdown(
        '<div class="brand-name">PETORA™</div>',
        unsafe_allow_html=True,
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
    unsafe_allow_html=True,
)

st.markdown("</div>", unsafe_allow_html=True)


# ============================================================
# NAVIGATION
# ============================================================

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
    unsafe_allow_html=True,
)


# ============================================================
# HERO
# ============================================================

st.markdown(
    """
    <div class="hero-box">

        <div class="hero-kicker">
            Welcome to PETORA
        </div>

        <div class="hero-title">
            Your Complete Pet Companion
        </div>

        <div class="hero-description">
            Find puppies, explore pets, check availability,
            ask PETORA AI questions and send enquiries.
        </div>

    </div>
    """,
    unsafe_allow_html=True,
)


# ============================================================
# FEATURE CARDS
# ============================================================

feature_columns = st.columns(4)

features = [
    ("🔎", "Browse", "Explore available pets."),
    ("🤖", "Ask PETORA AI", "Get instant pet information."),
    ("📞", "Enquire", "Send your interest directly."),
    ("❤️", "Pet Care", "Healthy and responsible guidance."),
]

for column, item in zip(feature_columns, features):

    icon, title, description = item

    with column:
        st.markdown(
            f"""
            <div class="feature-box">

                <div class="feature-icon">
                    {icon}
                </div>

                <div class="feature-title">
                    {title}
                </div>

                <div class="feature-description">
                    {description}
                </div>

            </div>
            """,
            unsafe_allow_html=True,
        )


st.markdown("<br>", unsafe_allow_html=True)


# ============================================================
# LOAD INVENTORY
# ============================================================

@st.cache_data
def load_inventory():

    if not os.path.exists(PUPPY_FILE):
        return pd.DataFrame()

    try:
        return pd.read_csv(PUPPY_FILE)
    except Exception:
        return pd.DataFrame()


inventory = load_inventory()


if inventory.empty:
    st.error(
        "Could not load data/puppies.csv."
    )
    st.stop()


# ============================================================
# ENSURE INVENTORY COLUMNS
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
# CLEAN INVENTORY
# ============================================================

text_columns = [
    "puppy_id",
    "breed",
    "gender",
    "status",
    "vaccinated",
    "location",
    "photo",
]

for column in text_columns:

    inventory[column] = (
        inventory[column]
        .fillna("")
        .astype(str)
        .str.strip()
    )


inventory["price"] = pd.to_numeric(
    inventory["price"],
    errors="coerce",
).fillna(0)


inventory["age_weeks"] = pd.to_numeric(
    inventory["age_weeks"],
    errors="coerce",
).fillna(0)


# ============================================================
# KNOWLEDGE BASE
# ============================================================

@st.cache_data
def load_knowledge():

    if not os.path.exists(KNOWLEDGE_FILE):
        return []

    try:

        with open(
            KNOWLEDGE_FILE,
            "r",
            encoding="utf-8",
        ) as file:

            content = file.read()

    except Exception:
        return []

    # Keep sentences as RAG chunks
    chunks = [
        chunk.strip()
        for chunk in re.split(
            r"[.!?]\s+",
            content,
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


# ============================================================
# KNOWLEDGE EMBEDDINGS
# ============================================================

if knowledge_chunks:

    knowledge_embeddings = embedding_model.encode(
        knowledge_chunks
    )

else:

    knowledge_embeddings = None


# ============================================================
# ENQUIRY FILE
# ============================================================

def ensure_enquiry_file():

    if not os.path.exists(ENQUIRY_FILE):

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
            index=False,
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
    message,
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
        index=False,
    )


# ============================================================
# PUPPY FUNCTIONS
# ============================================================

def find_puppy_id(text):

    match = re.search(
        r"\b[A-Za-z]{2}\d{3}\b",
        text,
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
        .eq(puppy_id.upper())
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


# ============================================================
# SESSION STATE
# ============================================================

if "messages" not in st.session_state:
    st.session_state.messages = []


if "lead_request" not in st.session_state:
    st.session_state.lead_request = None


# ============================================================
# AVAILABLE PUPPIES
# ============================================================

available = inventory[
    inventory["status"]
    .str.lower()
    .eq("available")
].copy()


# ============================================================
# MAIN CONTENT
# ============================================================

left, right = st.columns(
    [1.7, 1],
    gap="large",
)


# ============================================================
# LEFT SIDE - PUPPIES
# ============================================================

with left:

    st.markdown(
        '<div class="section-title">'
        '🐾 Available Puppies'
        '</div>',
        unsafe_allow_html=True,
    )

    st.markdown(
        '<div class="section-description">'
        'Browse our current puppy inventory and contact us directly.'
        '</div>',
        unsafe_allow_html=True,
    )

    if available.empty:

        st.info(
            "No puppies are currently available."
        )

    else:

        puppy_columns = st.columns(
            min(3, len(available))
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

                photo_value = str(
                    puppy["photo"]
                ).strip()

                photo_value = photo_value.lstrip(
                    "/"
                )

                image_path = os.path.join(
                    BASE_DIR,
                    photo_value,
                )


                if (
                    photo_value
                    and os.path.isfile(image_path)
                ):

                    try:

                        puppy_image = Image.open(
                            image_path
                        ).convert("RGB")

                        # Every card uses exactly the same
                        # image dimensions.
                        puppy_image = ImageOps.fit(
                            puppy_image,
                            (600, 450),
                            method=Image.Resampling.LANCZOS,
                            centering=(0.5, 0.5),
                        )

                        st.image(
                            puppy_image,
                            width="stretch",
                        )

                    except Exception:

                        st.warning(
                            "Image could not be loaded."
                        )

                else:

                    st.info(
                        "No image available."
                    )


                # ------------------------------------------------
                # DETAILS
                # ------------------------------------------------

                st.markdown(
                    f"### 🐶 {puppy['breed']}"
                )

                st.caption(
                    f"Puppy ID: {puppy['puppy_id']}"
                )

                st.write(
                    f"**Gender:** {puppy['gender']}"
                )

                st.write(
                    f"**Age:** "
                    f"{int(puppy['age_weeks'])} weeks"
                )

                st.markdown(
                    f"### ₹{puppy['price']:,.0f}"
                )

                st.success(
                    "✅ Available"
                )

                st.write(
                    f"Vaccinated: "
                    f"{puppy['vaccinated']}"
                )

                st.write(
                    f"Location: "
                    f"{puppy['location']}"
                )


                # ------------------------------------------------
                # INTEREST
                # ------------------------------------------------

                if st.button(
                    "📞 I'm Interested",
                    key=(
                        f"interest_"
                        f"{puppy['puppy_id']}"
                    ),
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
# RIGHT SIDE - AI ASSISTANT
# ============================================================

with right:

    st.markdown(
        """
        <div class="ai-panel">

            <div class="ai-title">
                🤖 PETORA AI Assistant
            </div>

            <div class="ai-description">
                Ask about puppies, prices, breeds,
                availability or pet care.
            </div>

        </div>
        """,
        unsafe_allow_html=True,
    )


    # --------------------------------------------------------
    # CHAT HISTORY
    # --------------------------------------------------------

    for message in st.session_state.messages:

        with st.chat_message(
            message["role"]
        ):

            st.markdown(
                message["content"]
            )


    # --------------------------------------------------------
    # CHAT INPUT
    # --------------------------------------------------------

    query = st.chat_input(
        "Ask PETORA AI..."
    )


    if query:

        st.session_state.messages.append(
            {
                "role": "user",
                "content": query,
            }
        )


        with st.chat_message("user"):

            st.write(query)


        # ----------------------------------------------------
        # PUPPY ID
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

        if detect_buying_intent(query):

            st.session_state.lead_request = {
                "puppy_id": puppy_id,
                "message": query,
            }


        # ----------------------------------------------------
        # EXACT INVENTORY RESPONSE
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
                    f"**{puppy_id} is available.**\n\n"
                    f"**Breed:** {puppy['breed']}\n\n"
                    f"**Gender:** {puppy['gender']}\n\n"
                    f"**Age:** {int(puppy['age_weeks'])} weeks\n\n"
                    f"**Price:** ₹{puppy['price']:,.0f}\n\n"
                    f"**Vaccinated:** {puppy['vaccinated']}\n\n"
                    f"**Location:** {puppy['location']}"
                )

            else:

                answer = (
                    f"**{puppy_id}** is currently "
                    f"{puppy['status'].lower()}."
                )


        else:

            # ------------------------------------------------
            # CONTEXT
            # ------------------------------------------------

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

            elif knowledge_embeddings is not None:

                query_embedding = (
                    embedding_model.encode(
                        [query]
                    )
                )

                similarity_scores = (
                    cosine_similarity(
                        query_embedding,
                        knowledge_embeddings,
                    )[0]
                )

                top_indices = (
                    similarity_scores.argsort()[
                        -3:
                    ][::-1]
                )

                context = "\n".join(
                    knowledge_chunks[i]
                    for i in top_indices
                )

            else:

                context = ""


            # ------------------------------------------------
            # HUGGING FACE
            # ------------------------------------------------

            try:

                hf_token = st.secrets[
                    "HF_TOKEN"
                ]

            except Exception:

                hf_token = None


            if not hf_token:

                answer = (
                    "PETORA AI is not configured yet. "
                    "Please add HF_TOKEN in Streamlit Secrets."
                )

            else:

                try:

                    client = InferenceClient(
                        api_key=hf_token,
                        provider="auto",
                    )


                    response = (
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
                                        "Assistant, a helpful "
                                        "assistant for a pet "
                                        "business. Use ONLY "
                                        "the supplied context. "
                                        "Never invent prices, "
                                        "availability, breeds, "
                                        "ages, vaccination "
                                        "records, locations "
                                        "or other business "
                                        "facts. If the answer "
                                        "is not in the context, "
                                        "say: 'I don't know "
                                        "based on the available "
                                        "information.'"
                                    ),
                                },
                                {
                                    "role": "user",
                                    "content": (
                                        f"Context:\n\n"
                                        f"{context}\n\n"
                                        f"Question:\n\n"
                                        f"{query}"
                                    ),
                                },
                            ],
                            max_tokens=300,
                            temperature=0.2,
                        )
                    )


                    answer = (
                        response
                        .choices[0]
                        .message
                        .content
                    )


                except Exception as error:

                    # Show a useful but safe error
                    # without exposing the secret.
                    answer = (
                        "PETORA AI could not complete "
                        "the request right now.\n\n"
                        "Please try again in a moment."
                    )


        # ----------------------------------------------------
        # DISPLAY ANSWER
        # ----------------------------------------------------

        with st.chat_message(
            "assistant"
        ):

            st.markdown(
                answer
            )


        st.session_state.messages.append(
            {
                "role": "assistant",
                "content": answer,
            }
        )


# ============================================================
# LEAD CAPTURE
# ============================================================

if st.session_state.lead_request:

    st.divider()

    st.markdown(
        '<div class="section-title">'
        '📞 Interested in a Puppy?'
        '</div>',
        unsafe_allow_html=True,
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
            "Please specify the puppy you are interested in."
        )


    with st.form(
        "petora_lead_form"
    ):

        customer_name = st.text_input(
            "Your Name"
        )

        customer_phone = st.text_input(
            "Phone Number"
        )

        submit_lead = st.form_submit_button(
            "Submit Enquiry"
        )


        if submit_lead:

            if not customer_name.strip():

                st.error(
                    "Please enter your name."
                )

            elif not customer_phone.strip():

                st.error(
                    "Please enter your phone number."
                )

            else:

                save_enquiry(
                    customer_name.strip(),
                    customer_phone.strip(),
                    lead_puppy_id,
                    lead_breed,
                    lead_message,
                )

                st.success(
                    "✅ Your enquiry has been submitted!"
                )

                st.session_state.lead_request = None

                st.rerun()


# ============================================================
# TRUST SECTION
# ============================================================

st.markdown(
    """
    <div class="trust-box">

        <div class="trust-title">
            🐾 Wide Range of Pets
            &nbsp;&nbsp; • &nbsp;&nbsp;
            🌿 Ethical & Responsible
            &nbsp;&nbsp; • &nbsp;&nbsp;
            🚚 Pan India
            &nbsp;&nbsp; • &nbsp;&nbsp;
            ❤️ Support & Guidance
        </div>

        <div class="trust-text">
            PETORA is designed to grow from puppies
            into a broader pet marketplace.
        </div>

    </div>
    """,
    unsafe_allow_html=True,
)


# ============================================================
# FOOTER
# ============================================================

st.markdown(
    """
    <div class="footer-box">

        <div class="footer-brand">
            PETORA™
        </div>

        <div class="footer-tagline">
            More Pets. A Wilder World.
        </div>

        <div class="footer-links">
            Dogs • Cats • Aquatics • Reptiles • Exotic Pets
        </div>

        <div style="margin-top:12px;">
            Care • Trust • Passion • For Every Species
        </div>

    </div>
    """,
    unsafe_allow_html=True,
)