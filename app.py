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
# PAGE CONFIGURATION
# ============================================================

st.set_page_config(
    page_title="PETORA | Pets Beyond Borders",
    page_icon="🐾",
    layout="wide",
    initial_sidebar_state="collapsed"
)


# ============================================================
# PROJECT PATHS
# ============================================================

BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

DATA_DIR = os.path.join(
    BASE_DIR,
    "data"
)

IMAGE_DIR = os.path.join(
    BASE_DIR,
    "images"
)

PUPPY_FILE = os.path.join(
    DATA_DIR,
    "puppies.csv"
)

KNOWLEDGE_FILE = os.path.join(
    DATA_DIR,
    "info.text"
)

ENQUIRY_FILE = os.path.join(
    DATA_DIR,
    "enquiries.csv"
)

LOGO_FILE = os.path.join(
    IMAGE_DIR,
    "petora-logo.png"
)


# ============================================================
# CUSTOM CSS
# ============================================================

st.markdown(
    """
    <style>

    .petora-header {
        text-align: center;
        padding: 10px 0 5px 0;
    }

    .petora-logo {
        max-width: 360px;
        margin: auto;
    }

    .petora-tagline {
        text-align: center;
        font-size: 18px;
        color: #8a6417;
        font-weight: 600;
        margin-top: -5px;
        margin-bottom: 20px;
    }

    .hero-box {
        background: linear-gradient(
            135deg,
            #f6f2e7,
            #ffffff
        );
        padding: 28px;
        border-radius: 18px;
        border: 1px solid #e5dfcf;
        margin-bottom: 25px;
    }

    .hero-title {
        font-size: 34px;
        font-weight: 700;
        color: #123b25;
    }

    .hero-text {
        font-size: 18px;
        color: #555;
    }

    .category-bar {
        text-align: center;
        padding: 12px;
        border-radius: 12px;
        background: #123b25;
        color: white;
        font-size: 15px;
        font-weight: 600;
        margin-bottom: 25px;
    }

    .feature-box {
        text-align: center;
        padding: 15px;
    }

    </style>
    """,
    unsafe_allow_html=True
)


# ============================================================
# PETORA BRAND HEADER
# ============================================================

st.markdown(
    '<div class="petora-header">',
    unsafe_allow_html=True
)

if os.path.isfile(LOGO_FILE):

    logo = Image.open(
        LOGO_FILE
    ).convert("RGB")

    st.image(
        logo,
        width=360
    )

else:

    st.title(
        "PETORA™"
    )

st.markdown(
    '<div class="petora-tagline">'
    'PETS BEYOND BORDERS • More Pets. A Wilder World.'
    '</div>',
    unsafe_allow_html=True
)


# ============================================================
# NAVIGATION
# ============================================================

st.markdown(
    """
    <div class="category-bar">
    🏠 Home &nbsp;&nbsp; | &nbsp;&nbsp;
    🐶 Dogs &nbsp;&nbsp; | &nbsp;&nbsp;
    🐱 Cats &nbsp;&nbsp; | &nbsp;&nbsp;
    🐟 Aquatics &nbsp;&nbsp; | &nbsp;&nbsp;
    🐍 Reptiles &nbsp;&nbsp; | &nbsp;&nbsp;
    🦜 Exotic Pets &nbsp;&nbsp; | &nbsp;&nbsp;
    🤖 AI Assistant
    </div>
    """,
    unsafe_allow_html=True
)


# ============================================================
# HERO SECTION
# ============================================================

st.markdown(
    """
    <div class="hero-box">

    <div class="hero-title">
    Welcome to PETORA
    </div>

    <div class="hero-text">
    Your AI-powered pet marketplace and pet companion.
    Find puppies, explore future pet categories, check
    availability, ask questions and send enquiries.
    </div>

    </div>
    """,
    unsafe_allow_html=True
)


# ============================================================
# FEATURE ROW
# ============================================================

feature_columns = st.columns(4)

with feature_columns[0]:

    st.markdown(
        """
        <div class="feature-box">
        <h3>🐾 Browse</h3>
        <p>Explore available pets.</p>
        </div>
        """,
        unsafe_allow_html=True
    )

with feature_columns[1]:

    st.markdown(
        """
        <div class="feature-box">
        <h3>🤖 Ask AI</h3>
        <p>Get instant pet information.</p>
        </div>
        """,
        unsafe_allow_html=True
    )

with feature_columns[2]:

    st.markdown(
        """
        <div class="feature-box">
        <h3>📞 Enquire</h3>
        <p>Send your interest directly.</p>
        </div>
        """,
        unsafe_allow_html=True
    )

with feature_columns[3]:

    st.markdown(
        """
        <div class="feature-box">
        <h3>❤️ Responsible</h3>
        <p>Pets, care and guidance.</p>
        </div>
        """,
        unsafe_allow_html=True
    )


st.divider()


# ============================================================
# HUGGING FACE CLIENT
# ============================================================

try:

    HF_TOKEN = st.secrets["HF_TOKEN"]

    hf_client = InferenceClient(
        api_key=HF_TOKEN,
        provider="auto"
    )

except Exception:

    HF_TOKEN = None
    hf_client = None


# ============================================================
# EMBEDDING MODEL
# ============================================================

@st.cache_resource
def load_embedding_model():

    return SentenceTransformer(
        "all-MiniLM-L6-v2"
    )


model = load_embedding_model()


# ============================================================
# LOAD KNOWLEDGE BASE
# ============================================================

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


# ============================================================
# LOAD PUPPY INVENTORY
# ============================================================

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
        "Puppy inventory could not be loaded."
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
    "photo"
]


for column in required_columns:

    if column not in inventory.columns:

        inventory[column] = ""


# ============================================================
# CLEAN INVENTORY
# ============================================================

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
                "status"
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

    new_row = pd.DataFrame(
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

    new_row.to_csv(
        ENQUIRY_FILE,
        mode="a",
        header=False,
        index=False
    )


# ============================================================
# FIND PUPPY ID
# ============================================================

def find_puppy_id(text):

    match = re.search(
        r"\b[A-Za-z]{2}\d{3}\b",
        text
    )

    if match:

        return match.group(0).upper()

    return ""


# ============================================================
# FIND PUPPY
# ============================================================

def find_puppy(
    puppy_id
):

    if not puppy_id:

        return None

    matches = inventory[
        inventory["puppy_id"]
        .str.upper()
        .eq(
            puppy_id.upper()
        )
    ]

    if len(matches) > 0:

        return matches.iloc[0]

    return None


# ============================================================
# BUYING INTENT
# ============================================================

def detect_buying_intent(
    text
):

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

st.subheader(
    "🐾 Available Puppies"
)


available = inventory[
    inventory["status"]
    .str.lower()
    .eq("available")
].copy()


if len(available) == 0:

    st.info(
        "No puppies are currently available."
    )

else:

    columns = st.columns(3)

    for i, (_, puppy) in enumerate(
        available.iterrows()
    ):

        with columns[
            i % 3
        ]:

            # ================================================
            # PUPPY IMAGE
            # ================================================

            photo_name = str(
                puppy["photo"]
            ).strip()

            photo_name = photo_name.lstrip(
                "/"
            )

            image_path = ""

            if photo_name:

                image_path = os.path.join(
                    BASE_DIR,
                    photo_name
                )


            if (
                image_path
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

                    st.warning(
                        "Unable to load image."
                    )

            else:

                placeholder = Image.new(
                    "RGB",
                    (600, 450),
                    "lightgray"
                )

                st.image(
                    placeholder,
                    width="stretch"
                )


            # ================================================
            # PUPPY DETAILS
            # ================================================

            st.subheader(
                f"🐶 {puppy['breed']}"
            )

            st.write(
                f"**Puppy ID:** "
                f"{puppy['puppy_id']}"
            )

            st.write(
                f"**Gender:** "
                f"{puppy['gender']}"
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


            # ================================================
            # INTEREST BUTTON
            # ================================================

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
                    )
                }

                st.rerun()


st.divider()


# ============================================================
# CHAT SECTION
# ============================================================

st.subheader(
    "🤖 Ask PETORA AI"
)

st.caption(
    "Ask about puppies, prices, availability, "
    "breeds or our pet business."
)


# ============================================================
# DISPLAY CHAT HISTORY
# ============================================================

for message in st.session_state.messages:

    with st.chat_message(
        message["role"]
    ):

        st.markdown(
            message["content"]
        )


# ============================================================
# CHAT INPUT
# ============================================================

query = st.chat_input(
    "Ask about puppies, prices or availability..."
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


    # ========================================================
    # PUPPY ID LOOKUP
    # ========================================================

    puppy_id = find_puppy_id(
        query
    )

    puppy = find_puppy(
        puppy_id
    )


    # ========================================================
    # BUYING INTENT
    # ========================================================

    if detect_buying_intent(
        query
    ):

        st.session_state.lead_request = {
            "puppy_id": puppy_id,
            "message": query
        }


    # ========================================================
    # EXACT PUPPY ANSWER
    # ========================================================

    if (
        puppy_id
        and puppy is not None
    ):

        status = str(
            puppy["status"]
        )


        if status.lower() == "available":

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
                f"{status.lower()}."
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


    else:

        # ====================================================
        # BUILD CONTEXT
        # ====================================================

        inventory_keywords = [
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
            for word in inventory_keywords
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


        # ====================================================
        # HUGGING FACE RESPONSE
        # ====================================================

        if hf_client is None:

            answer = (
                "The PETORA AI service is not configured. "
                "Please check the HF_TOKEN in Streamlit Secrets."
            )

        else:

            try:

                completion = (
                    hf_client.chat.completions.create(
                        model=(
                            "Qwen/"
                            "Qwen2.5-7B-Instruct"
                        ),
                        messages=[
                            {
                                "role": "system",
                                "content": (
                                    "You are PETORA AI Assistant, "
                                    "a helpful assistant for a pet "
                                    "business. Use ONLY the provided "
                                    "context. Never invent prices, "
                                    "availability, breeds, ages, "
                                    "vaccination records or other "
                                    "business facts. If information "
                                    "is not available, say: "
                                    "'I don't know based on the "
                                    "available information.' "
                                    "Keep answers clear and helpful."
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
                        max_tokens=300,
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
                    "Sorry, PETORA AI is temporarily "
                    "unavailable. Please try again."
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


# ============================================================
# LEAD CAPTURE
# ============================================================

if st.session_state.lead_request:

    st.divider()

    st.subheader(
        "📞 Interested in This Puppy?"
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
            "Please tell us which puppy "
            "you are interested in."
        )


    with st.form(
        "lead_capture_form"
    ):

        customer_name = st.text_input(
            "Your Name"
        )

        customer_phone = st.text_input(
            "Phone Number"
        )

        submitted = st.form_submit_button(
            "Submit Enquiry"
        )


        if submitted:

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
                    puppy_id,
                    breed,
                    original_message
                )

                st.success(
                    "✅ Your enquiry has been submitted!"
                )

                st.session_state.lead_request = None

                st.rerun()


# ============================================================
# FOOTER
# ============================================================

st.divider()

st.markdown(
    """
    <div style="text-align:center; padding:25px 0;">

    <h3>🐾 PETORA™</h3>

    <p>
    <b>PETS BEYOND BORDERS</b>
    </p>

    <p>
    Dogs • Cats • Aquatics • Reptiles • Exotic Pets
    </p>

    <p>
    <i>More Pets. A Wilder World.</i>
    </p>

    </div>
    """,
    unsafe_allow_html=True
)