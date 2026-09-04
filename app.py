import os
import re
from datetime import datetime

import pandas as pd
import requests
import streamlit as st
from PIL import Image, ImageOps
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity


# ==================================================
# PAGE CONFIGURATION
# ==================================================

st.set_page_config(
    page_title="Pet Business AI Assistant",
    page_icon="🐶",
    layout="wide"
)


# ==================================================
# PROJECT PATH
# ==================================================

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


# ==================================================
# CUSTOM CSS
# ==================================================

st.markdown(
    """
    <style>

    .main-title {
        font-size: 42px;
        font-weight: 700;
        margin-bottom: 5px;
    }

    .subtitle {
        font-size: 18px;
        color: #666;
        margin-bottom: 30px;
    }

    </style>
    """,
    unsafe_allow_html=True
)


# ==================================================
# HEADER
# ==================================================

st.markdown(
    '<div class="main-title">'
    '🐶 Pet Business AI Assistant'
    '</div>',
    unsafe_allow_html=True
)

st.markdown(
    '<div class="subtitle">'
    'Find puppies, check availability, ask questions '
    'and send an enquiry.'
    '</div>',
    unsafe_allow_html=True
)


# ==================================================
# LOAD EMBEDDING MODEL
# ==================================================

@st.cache_resource
def load_model():

    return SentenceTransformer(
        "all-MiniLM-L6-v2"
    )


model = load_model()


# ==================================================
# LOAD KNOWLEDGE BASE
# ==================================================

@st.cache_data
def load_knowledge():

    if not os.path.exists(KNOWLEDGE_FILE):

        return []

    with open(
        KNOWLEDGE_FILE,
        "r",
        encoding="utf-8"
    ) as file:

        content = file.read()

    chunks = content.split(".")

    chunks = [
        chunk.strip()
        for chunk in chunks
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


# ==================================================
# LOAD PUPPY INVENTORY
# ==================================================

@st.cache_data
def load_inventory():

    if not os.path.exists(PUPPY_FILE):

        return pd.DataFrame()

    return pd.read_csv(
        PUPPY_FILE
    )


inventory = load_inventory()


if inventory.empty:

    st.error(
        "puppies.csv was not found."
    )

    st.stop()


# ==================================================
# REQUIRED COLUMNS
# ==================================================

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


# ==================================================
# CLEAN INVENTORY
# ==================================================

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


# ==================================================
# CREATE ENQUIRY FILE
# ==================================================

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
                "status"
            ]
        ).to_csv(
            ENQUIRY_FILE,
            index=False
        )


ensure_enquiry_file()


# ==================================================
# SAVE ENQUIRY
# ==================================================

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


# ==================================================
# FIND PUPPY ID
# ==================================================

def find_puppy_id(text):

    match = re.search(
        r"\b[A-Za-z]{2}\d{3}\b",
        text
    )

    if match:

        return match.group(0).upper()

    return ""


# ==================================================
# FIND PUPPY
# ==================================================

def find_puppy(puppy_id):

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


# ==================================================
# BUYING INTENT
# ==================================================

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


# ==================================================
# SESSION STATE
# ==================================================

if "messages" not in st.session_state:

    st.session_state.messages = []


if "lead_request" not in st.session_state:

    st.session_state.lead_request = None


# ==================================================
# AVAILABLE PUPPIES
# ==================================================

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

        with columns[i % 3]:

            # ------------------------------------------
            # IMAGE
            # ------------------------------------------

            photo_name = str(
                puppy["photo"]
            ).strip()


            if (
                photo_name
                and photo_name.lower() != "nan"
            ):

                # Remove accidental leading slash
                photo_name = photo_name.lstrip("/")

                image_path = os.path.join(
                    BASE_DIR,
                    photo_name
                )

            else:

                image_path = ""


            if (
                image_path
                and os.path.isfile(image_path)
            ):

                try:

                    image = Image.open(
                        image_path
                    ).convert("RGB")

                    # Same size for every puppy
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
                        "Unable to load this image."
                    )

            else:

                # Show grey placeholder
                placeholder = Image.new(
                    "RGB",
                    (600, 450),
                    "lightgray"
                )

                st.image(
                    placeholder,
                    width="stretch"
                )

                st.caption(
                    f"Photo not found: {photo_name}"
                )


            # ------------------------------------------
            # PUPPY INFORMATION
            # ------------------------------------------

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


            # ------------------------------------------
            # INTEREST BUTTON
            # ------------------------------------------

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


# ==================================================
# CHAT HISTORY
# ==================================================

for message in st.session_state.messages:

    with st.chat_message(
        message["role"]
    ):

        st.markdown(
            message["content"]
        )


# ==================================================
# CHAT INPUT
# ==================================================

query = st.chat_input(
    "Ask about puppies, prices or availability..."
)


if query:

    # ----------------------------------------------
    # SAVE USER MESSAGE
    # ----------------------------------------------

    st.session_state.messages.append(
        {
            "role": "user",
            "content": query
        }
    )

    with st.chat_message("user"):

        st.write(query)


    # ----------------------------------------------
    # FIND PUPPY
    # ----------------------------------------------

    puppy_id = find_puppy_id(query)

    puppy = find_puppy(
        puppy_id
    )


    # ----------------------------------------------
    # BUYING INTENT
    # ----------------------------------------------

    if detect_buying_intent(query):

        st.session_state.lead_request = {
            "puppy_id": puppy_id,
            "message": query
        }


    # ----------------------------------------------
    # EXACT PUPPY LOOKUP
    # ----------------------------------------------

    if puppy_id and puppy is not None:

        status = str(
            puppy["status"]
        )

        breed = str(
            puppy["breed"]
        )

        gender = str(
            puppy["gender"]
        )

        age = puppy["age_weeks"]

        price = puppy["price"]

        vaccinated = str(
            puppy["vaccinated"]
        )

        location = str(
            puppy["location"]
        )


        if status.lower() == "available":

            answer = (
                f"**{puppy_id} is available.**\n\n"
                f"Breed: {breed}\n\n"
                f"Gender: {gender}\n\n"
                f"Age: {age:.0f} weeks\n\n"
                f"Price: ₹{price:,.0f}\n\n"
                f"Vaccinated: {vaccinated}\n\n"
                f"Location: {location}"
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

        # ------------------------------------------
        # INVENTORY QUESTIONS
        # ------------------------------------------

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


        is_inventory_question = any(
            word in query.lower()
            for word in inventory_keywords
        )


        # ------------------------------------------
        # RETRIEVE CONTEXT
        # ------------------------------------------

        if is_inventory_question:

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


        # ------------------------------------------
        # LOCAL LLAMA
        # ------------------------------------------

        try:

            response = requests.post(
                "http://localhost:11434/api/chat",
                json={
                    "model": "llama3.2:3b",
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "You are a helpful pet "
                                "business assistant. "
                                "Use ONLY the provided "
                                "context. "
                                "Do not invent prices, "
                                "availability, ages, "
                                "breeds, vaccination "
                                "information or other "
                                "business facts. "
                                "If the information is "
                                "not in the context, say: "
                                "'I don't know based on "
                                "the available information.'"
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
                    "stream": False
                },
                timeout=120
            )

            response.raise_for_status()

            result = response.json()

            answer = result[
                "message"
            ][
                "content"
            ]

        except requests.RequestException:

            answer = (
                "The local AI model is not available. "
                "Please make sure Ollama is running."
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


# ==================================================
# LEAD CAPTURE FORM
# ==================================================

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