import os
import html
import base64
import textwrap

import pandas as pd
import streamlit as st


# =========================================================
# PAGE CONFIG
# =========================================================

st.set_page_config(
    page_title="PETORA Admin",
    page_icon="🔐",
    layout="wide",
)


# =========================================================
# PATHS
# =========================================================

BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

DATA_DIR = os.path.join(
    BASE_DIR,
    "data",
)

IMAGE_DIR = os.path.join(
    BASE_DIR,
    "images",
)

INVENTORY_FILE = os.path.join(
    DATA_DIR,
    "puppies.csv",
)

ENQUIRY_FILE = os.path.join(
    DATA_DIR,
    "enquiries.csv",
)

LOGO_FILE = os.path.join(
    IMAGE_DIR,
    "petora-logo.png",
)


# =========================================================
# ADMIN PASSWORD
# =========================================================

try:
    ADMIN_PASSWORD = str(
        st.secrets["PETORA_ADMIN_PASSWORD"]
    ).strip()
except Exception:
    ADMIN_PASSWORD = os.getenv(
        "PETORA_ADMIN_PASSWORD",
        "",
    ).strip()


# =========================================================
# HTML
# =========================================================

def render_html(content):
    st.html(
        textwrap.dedent(
            content
        ).strip()
    )


# =========================================================
# CSS
# =========================================================

render_html(
    """
    <style>

    @import url(
        'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700&display=swap'
    );

    html,
    body,
    [class*="css"] {
        font-family: 'DM Sans', sans-serif;
    }

    .stApp {
        background:
            radial-gradient(
                circle at top right,
                rgba(225,239,222,0.65),
                transparent 30%
            ),
            #f8f6ef;
    }

    .block-container {
        max-width: 1400px;
        padding-top: 1.2rem;
        padding-bottom: 3rem;
    }

    #MainMenu {
        visibility: hidden;
    }

    footer {
        visibility: hidden;
    }


    .admin-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;

        background: white;

        border: 1px solid #e6e0d5;

        border-radius: 22px;

        padding: 18px 25px;

        margin-bottom: 22px;

        box-shadow:
            0 10px 35px rgba(18,59,43,0.07);
    }


    .admin-brand {
        display: flex;
        align-items: center;
        gap: 15px;
    }


    .admin-logo {
        width: 66px;
        height: 66px;
        object-fit: contain;
    }


    .admin-title {
        font-family:
            'Playfair Display',
            serif;

        font-size: 30px;

        font-weight: 700;

        color: #0c4a32;
    }


    .admin-subtitle {
        font-size: 11px;

        font-weight: 800;

        letter-spacing: 2px;

        color: #a37a17;

        text-transform: uppercase;

        margin-top: 5px;
    }


    .admin-badge {
        background: #edf5ec;

        color: #155039;

        padding: 9px 13px;

        border-radius: 999px;

        font-size: 12px;

        font-weight: 800;
    }


    .kpi-card {
        background: white;

        border: 1px solid #e6e1d6;

        border-radius: 18px;

        padding: 20px;

        box-shadow:
            0 8px 25px rgba(18,59,43,0.05);
    }


    .kpi-label {
        color: #808b83;

        font-size: 11px;

        font-weight: 800;

        letter-spacing: 1.4px;

        text-transform: uppercase;
    }


    .kpi-value {
        color: #104a34;

        font-size: 29px;

        font-weight: 800;

        margin-top: 8px;
    }


    .panel {
        background: white;

        border: 1px solid #e5e0d4;

        border-radius: 22px;

        padding: 24px;

        margin-top: 25px;

        box-shadow:
            0 8px 28px rgba(18,59,43,0.05);
    }


    .panel-title {
        color: #104a34;

        font-family:
            'Playfair Display',
            serif;

        font-size: 28px;

        margin-bottom: 5px;
    }


    .panel-copy {
        color: #738078;

        font-size: 13px;

        margin-bottom: 20px;
    }


    .status-available {
        color: #176038;

        font-weight: 800;
    }


    .status-sold {
        color: #9b4534;

        font-weight: 800;
    }


    .footer {
        margin-top: 40px;

        background: #0a3f2b;

        border-radius: 22px;

        padding: 25px;

        color: rgba(255,255,255,0.75);
    }

    </style>
    """
)


# =========================================================
# SESSION
# =========================================================

if "admin_authenticated" not in st.session_state:
    st.session_state["admin_authenticated"] = False


# =========================================================
# AUTHENTICATION
# =========================================================

if not st.session_state["admin_authenticated"]:

    render_html(
        """
        <div
            style="
                max-width:520px;
                margin:80px auto;
                background:white;
                border:1px solid #e5e0d4;
                border-radius:24px;
                padding:35px;
                box-shadow:0 15px 45px rgba(18,59,43,0.08);
                text-align:center;
            "
        >

            <div
                style="
                    font-size:48px;
                    margin-bottom:12px;
                "
            >
                🔐
            </div>

            <div
                style="
                    font-family:'Playfair Display',serif;
                    font-size:32px;
                    font-weight:700;
                    color:#104a34;
                "
            >
                PETORA Admin
            </div>

            <div
                style="
                    color:#748078;
                    margin-top:8px;
                    font-size:14px;
                "
            >
                Secure inventory management
            </div>

        </div>
        """
    )

    password = st.text_input(
        "Admin Password",
        type="password",
    )

    if st.button(
        "Login",
        width="stretch",
    ):

        if (
            ADMIN_PASSWORD
            and password == ADMIN_PASSWORD
        ):

            st.session_state[
                "admin_authenticated"
            ] = True

            st.rerun()

        elif not ADMIN_PASSWORD:

            st.error(
                "PETORA_ADMIN_PASSWORD has not "
                "been configured in Streamlit secrets."
            )

        else:

            st.error(
                "Incorrect admin password."
            )

    st.stop()


# =========================================================
# INVENTORY
# =========================================================

def load_inventory():

    if not os.path.exists(
        INVENTORY_FILE
    ):

        return pd.DataFrame(
            columns=[
                "pet_id",
                "category",
                "species",
                "breed",
                "name",
                "gender",
                "age",
                "price",
                "status",
                "vaccinated",
                "location",
                "photo",
                "description",
            ]
        )

    try:

        df = pd.read_csv(
            INVENTORY_FILE
        )

        required_columns = [
            "pet_id",
            "category",
            "species",
            "breed",
            "name",
            "gender",
            "age",
            "price",
            "status",
            "vaccinated",
            "location",
            "photo",
            "description",
        ]

        for column in required_columns:

            if column not in df.columns:
                df[column] = ""

        return df[
            required_columns
        ].copy()

    except Exception as exc:

        st.error(
            f"Could not read inventory: {exc}"
        )

        return pd.DataFrame()


def save_inventory(df):

    os.makedirs(
        DATA_DIR,
        exist_ok=True,
    )

    df.to_csv(
        INVENTORY_FILE,
        index=False,
    )


def load_enquiries():

    columns = [
        "date",
        "name",
        "phone",
        "pet_id",
        "breed",
        "message",
        "status",
    ]

    if not os.path.exists(
        ENQUIRY_FILE
    ):

        return pd.DataFrame(
            columns=columns
        )

    try:

        df = pd.read_csv(
            ENQUIRY_FILE
        )

        for column in columns:

            if column not in df.columns:
                df[column] = ""

        return df[columns].copy()

    except Exception:

        return pd.DataFrame(
            columns=columns
        )


inventory = load_inventory()
enquiries = load_enquiries()


# =========================================================
# HEADER
# =========================================================

logo_html = ""

if os.path.exists(
    LOGO_FILE
):

    try:

        with open(
            LOGO_FILE,
            "rb",
        ) as image_file:

            image_data = base64.b64encode(
                image_file.read()
            ).decode()

        logo_html = (
            f"""
            <img
                src="data:image/png;base64,{image_data}"
                class="admin-logo"
                alt="PETORA"
            >
            """
        )

    except Exception:
        logo_html = ""


render_html(
    f"""
    <div class="admin-header">

        <div class="admin-brand">

            {logo_html}

            <div>

                <div class="admin-title">
                    PETORA Admin
                </div>

                <div class="admin-subtitle">
                    Inventory Control Center
                </div>

            </div>

        </div>

        <div class="admin-badge">
            🔒 ADMIN ACCESS
        </div>

    </div>
    """
)


# =========================================================
# LOGOUT
# =========================================================

if st.button(
    "Logout",
):

    st.session_state[
        "admin_authenticated"
    ] = False

    st.rerun()


# =========================================================
# KPI
# =========================================================

available_count = 0
sold_count = 0
inventory_value = 0
category_count = 0

if not inventory.empty:

    status_series = (
        inventory["status"]
        .astype(str)
        .str.lower()
        .str.strip()
    )

    available_count = int(
        (
            status_series
            == "available"
        ).sum()
    )

    sold_count = int(
        (
            status_series
            == "sold"
        ).sum()
    )

    numeric_prices = pd.to_numeric(
        inventory["price"],
        errors="coerce",
    ).fillna(0)

    inventory_value = (
        numeric_prices[
            status_series == "available"
        ].sum()
    )

    category_count = (
        inventory["category"]
        .replace("", pd.NA)
        .dropna()
        .nunique()
    )


k1, k2, k3, k4 = st.columns(4)


with k1:

    render_html(
        f"""
        <div class="kpi-card">

            <div class="kpi-label">
                Total Listings
            </div>

            <div class="kpi-value">
                {len(inventory)}
            </div>

        </div>
        """
    )


with k2:

    render_html(
        f"""
        <div class="kpi-card">

            <div class="kpi-label">
                Available
            </div>

            <div class="kpi-value">
                {available_count}
            </div>

        </div>
        """
    )


with k3:

    render_html(
        f"""
        <div class="kpi-card">

            <div class="kpi-label">
                Inventory Value
            </div>

            <div class="kpi-value">
                ₹{inventory_value:,.0f}
            </div>

        </div>
        """
    )


with k4:

    render_html(
        f"""
        <div class="kpi-card">

            <div class="kpi-label">
                Categories
            </div>

            <div class="kpi-value">
                {category_count}
            </div>

        </div>
        """
    )


# =========================================================
# TABS
# =========================================================

tab_add, tab_manage, tab_enquiries = st.tabs(
    [
        "➕ Add Pet",
        "📦 Manage Inventory",
        "📋 Enquiries",
    ]
)


# =========================================================
# ADD PET
# =========================================================

with tab_add:

    render_html(
        """
        <div class="panel-title">
            Add New Pet
        </div>

        <div class="panel-copy">
            Create a new listing for the PETORA marketplace.
        </div>
        """
    )

    with st.form(
        "add_pet_form",
        clear_on_submit=True,
    ):

        row1 = st.columns(3)

        with row1[0]:

            pet_id = st.text_input(
                "Pet ID *",
                placeholder="Example: ST003",
            )

        with row1[1]:

            category = st.selectbox(
                "Category *",
                [
                    "Dogs",
                    "Cats",
                    "Aquatics",
                    "Reptiles",
                    "Exotic Pets",
                ],
            )

        with row1[2]:

            species = st.text_input(
                "Species *",
                placeholder="Dog / Cat / Fish",
            )


        row2 = st.columns(3)

        with row2[0]:

            breed = st.text_input(
                "Breed / Type *",
                placeholder="Shih Tzu / Arowana",
            )

        with row2[1]:

            pet_name = st.text_input(
                "Pet Name",
                placeholder="Lucky",
            )

        with row2[2]:

            gender = st.selectbox(
                "Gender",
                [
                    "Male",
                    "Female",
                    "Unknown",
                ],
            )


        row3 = st.columns(3)

        with row3[0]:

            age = st.text_input(
                "Age",
                placeholder="8 weeks",
            )

        with row3[1]:

            price = st.number_input(
                "Price (₹)",
                min_value=0.0,
                step=500.0,
            )

        with row3[2]:

            status = st.selectbox(
                "Status",
                [
                    "Available",
                    "Sold",
                ],
            )


        row4 = st.columns(3)

        with row4[0]:

            vaccinated = st.selectbox(
                "Vaccinated / Health Info",
                [
                    "Yes",
                    "No",
                    "N/A",
                ],
            )

        with row4[1]:

            location = st.text_input(
                "Location",
                placeholder="Patna",
            )

        with row4[2]:

            photo = st.text_input(
                "Photo Path",
                placeholder="images/ST003.jpg",
            )


        description = st.text_area(
            "Description",
            placeholder=(
                "Describe the pet and listing..."
            ),
        )


        add_submitted = st.form_submit_button(
            "➕ Add Pet",
            width="stretch",
        )


        if add_submitted:

            required_values = [
                pet_id.strip(),
                category.strip(),
                species.strip(),
                breed.strip(),
            ]

            if not all(
                required_values
            ):

                st.error(
                    "Please fill all required fields marked with *."
                )

            elif (
                not inventory.empty
                and pet_id.strip().lower()
                in inventory[
                    "pet_id"
                ]
                .astype(str)
                .str.lower()
                .values
            ):

                st.error(
                    "A pet with this Pet ID already exists."
                )

            else:

                new_pet = pd.DataFrame(
                    [
                        {
                            "pet_id": pet_id.strip(),
                            "category": category,
                            "species": species.strip(),
                            "breed": breed.strip(),
                            "name": pet_name.strip(),
                            "gender": gender,
                            "age": age.strip(),
                            "price": price,
                            "status": status,
                            "vaccinated": vaccinated,
                            "location": location.strip(),
                            "photo": photo.strip(),
                            "description": description.strip(),
                        }
                    ]
                )

                inventory = pd.concat(
                    [
                        inventory,
                        new_pet,
                    ],
                    ignore_index=True,
                )

                save_inventory(
                    inventory
                )

                st.success(
                    f"{breed} listing "
                    f"{pet_id} added successfully."
                )

                st.rerun()


# =========================================================
# MANAGE INVENTORY
# =========================================================

with tab_manage:

    render_html(
        """
        <div class="panel-title">
            Manage Inventory
        </div>

        <div class="panel-copy">
            Search, edit and delete PETORA listings.
        </div>
        """
    )


    if inventory.empty:

        st.info(
            "No inventory records found."
        )

    else:

        search_inventory = st.text_input(
            "Search Inventory",
            placeholder=(
                "Search Pet ID, breed, name or category..."
            ),
        )


        display_inventory = (
            inventory.copy()
        )


        if search_inventory.strip():

            search_value = (
                search_inventory
                .strip()
                .lower()
            )

            search_mask = pd.Series(
                False,
                index=display_inventory.index,
            )

            for column in [
                "pet_id",
                "category",
                "species",
                "breed",
                "name",
                "location",
            ]:

                search_mask = (
                    search_mask
                    |
                    display_inventory[
                        column
                    ]
                    .astype(str)
                    .str.lower()
                    .str.contains(
                        search_value,
                        na=False,
                        regex=False,
                    )
                )

            display_inventory = (
                display_inventory[
                    search_mask
                ]
            )


        st.dataframe(
            display_inventory,
            width="stretch",
            hide_index=True,
        )


        st.markdown(
            "### Edit Listing"
        )


        edit_options = (
            display_inventory[
                "pet_id"
            ]
            .astype(str)
            .tolist()
        )


        if edit_options:

            selected_edit_id = st.selectbox(
                "Select Pet ID",
                edit_options,
            )


            selected_rows = inventory[
                inventory[
                    "pet_id"
                ]
                .astype(str)
                ==
                selected_edit_id
            ]


            if not selected_rows.empty:

                selected_pet = (
                    selected_rows.iloc[0]
                )


                with st.form(
                    "edit_pet_form"
                ):

                    e1, e2, e3 = st.columns(3)


                    with e1:

                        edit_category = st.selectbox(
                            "Category",
                            [
                                "Dogs",
                                "Cats",
                                "Aquatics",
                                "Reptiles",
                                "Exotic Pets",
                            ],
                            index=(
                                [
                                    "Dogs",
                                    "Cats",
                                    "Aquatics",
                                    "Reptiles",
                                    "Exotic Pets",
                                ].index(
                                    selected_pet["category"]
                                )
                                if selected_pet[
                                    "category"
                                ]
                                in [
                                    "Dogs",
                                    "Cats",
                                    "Aquatics",
                                    "Reptiles",
                                    "Exotic Pets",
                                ]
                                else 0
                            ),
                        )


                    with e2:

                        edit_breed = st.text_input(
                            "Breed / Type",
                            value=str(
                                selected_pet[
                                    "breed"
                                ]
                            ),
                        )


                    with e3:

                        edit_name = st.text_input(
                            "Name",
                            value=str(
                                selected_pet[
                                    "name"
                                ]
                            ),
                        )


                    e4, e5, e6 = st.columns(3)


                    with e4:

                        edit_gender = st.selectbox(
                            "Gender",
                            [
                                "Male",
                                "Female",
                                "Unknown",
                            ],
                            index=(
                                [
                                    "Male",
                                    "Female",
                                    "Unknown",
                                ].index(
                                    str(
                                        selected_pet[
                                            "gender"
                                        ]
                                    )
                                )
                                if str(
                                    selected_pet[
                                        "gender"
                                    ]
                                )
                                in [
                                    "Male",
                                    "Female",
                                    "Unknown",
                                ]
                                else 0
                            ),
                        )


                    with e5:

                        edit_age = st.text_input(
                            "Age",
                            value=str(
                                selected_pet[
                                    "age"
                                ]
                            ),
                        )


                    with e6:

                        try:

                            existing_price = float(
                                selected_pet[
                                    "price"
                                ]
                            )

                        except Exception:

                            existing_price = 0.0


                        edit_price = st.number_input(
                            "Price (₹)",
                            min_value=0.0,
                            value=existing_price,
                            step=500.0,
                        )


                    e7, e8, e9 = st.columns(3)


                    with e7:

                        edit_status = st.selectbox(
                            "Status",
                            [
                                "Available",
                                "Sold",
                            ],
                            index=(
                                0
                                if str(
                                    selected_pet[
                                        "status"
                                    ]
                                ).lower()
                                == "available"
                                else 1
                            ),
                        )


                    with e8:

                        edit_vaccinated = st.selectbox(
                            "Vaccinated / Health",
                            [
                                "Yes",
                                "No",
                                "N/A",
                            ],
                            index=(
                                [
                                    "Yes",
                                    "No",
                                    "N/A",
                                ].index(
                                    str(
                                        selected_pet[
                                            "vaccinated"
                                        ]
                                    )
                                )
                                if str(
                                    selected_pet[
                                        "vaccinated"
                                    ]
                                )
                                in [
                                    "Yes",
                                    "No",
                                    "N/A",
                                ]
                                else 2
                            ),
                        )


                    with e9:

                        edit_location = st.text_input(
                            "Location",
                            value=str(
                                selected_pet[
                                    "location"
                                ]
                            ),
                        )


                    edit_photo = st.text_input(
                        "Photo Path",
                        value=str(
                            selected_pet[
                                "photo"
                            ]
                        ),
                    )


                    edit_description = st.text_area(
                        "Description",
                        value=str(
                            selected_pet[
                                "description"
                            ]
                        ),
                    )


                    update_submitted = (
                        st.form_submit_button(
                            "💾 Save Changes",
                            width="stretch",
                        )
                    )


                    if update_submitted:

                        row_index = (
                            inventory.index[
                                inventory[
                                    "pet_id"
                                ]
                                .astype(str)
                                ==
                                selected_edit_id
                            ]
                        )


                        if len(row_index) == 1:

                            idx = row_index[0]

                            inventory.at[
                                idx,
                                "category"
                            ] = edit_category

                            inventory.at[
                                idx,
                                "breed"
                            ] = edit_breed.strip()

                            inventory.at[
                                idx,
                                "name"
                            ] = edit_name.strip()

                            inventory.at[
                                idx,
                                "gender"
                            ] = edit_gender

                            inventory.at[
                                idx,
                                "age"
                            ] = edit_age.strip()

                            inventory.at[
                                idx,
                                "price"
                            ] = edit_price

                            inventory.at[
                                idx,
                                "status"
                            ] = edit_status

                            inventory.at[
                                idx,
                                "vaccinated"
                            ] = edit_vaccinated

                            inventory.at[
                                idx,
                                "location"
                            ] = edit_location.strip()

                            inventory.at[
                                idx,
                                "photo"
                            ] = edit_photo.strip()

                            inventory.at[
                                idx,
                                "description"
                            ] = edit_description.strip()


                            save_inventory(
                                inventory
                            )


                            st.success(
                                f"{selected_edit_id} "
                                "updated successfully."
                            )

                            st.rerun()


            st.markdown(
                "### Delete Listing"
            )


            delete_confirm = st.checkbox(
                "I understand that deleting a listing cannot be undone."
            )


            if st.button(
                "🗑️ Delete Selected Listing",
                width="stretch",
            ):

                if not delete_confirm:

                    st.warning(
                        "Please confirm the deletion first."
                    )

                else:

                    inventory = inventory[
                        inventory[
                            "pet_id"
                        ]
                        .astype(str)
                        != selected_edit_id
                    ].reset_index(
                        drop=True
                    )

                    save_inventory(
                        inventory
                    )

                    st.success(
                        f"{selected_edit_id} deleted."
                    )

                    st.rerun()


# =========================================================
# ENQUIRIES
# =========================================================

with tab_enquiries:

    render_html(
        """
        <div class="panel-title">
            Customer Enquiries
        </div>

        <div class="panel-copy">
            View enquiries submitted through PETORA.
        </div>
        """
    )


    if enquiries.empty:

        st.info(
            "No enquiries have been recorded yet."
        )

    else:

        st.dataframe(
            enquiries,
            width="stretch",
            hide_index=True,
        )


        st.markdown(
            "### Enquiry Summary"
        )


        c1, c2, c3 = st.columns(3)


        with c1:

            st.metric(
                "Total Enquiries",
                len(enquiries),
            )


        with c2:

            if "status" in enquiries.columns:

                new_count = int(
                    (
                        enquiries[
                            "status"
                        ]
                        .astype(str)
                        .str.lower()
                        == "new"
                    ).sum()
                )

            else:

                new_count = 0


            st.metric(
                "New",
                new_count,
            )


        with c3:

            if "pet_id" in enquiries.columns:

                unique_pets = (
                    enquiries[
                        "pet_id"
                    ]
                    .dropna()
                    .nunique()
                )

            else:

                unique_pets = 0


            st.metric(
                "Pets Enquired About",
                unique_pets,
            )


# =========================================================
# FOOTER
# =========================================================

render_html(
    """
    <div class="footer">

        <strong>
            PETORA Admin
        </strong>

        <br><br>

        Inventory management · Customer enquiries ·
        Marketplace control

    </div>
    """
)