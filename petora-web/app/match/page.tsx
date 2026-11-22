
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ui from "./match-dashboard.module.css";

type Animal = {
  id: string;
  owner_id: string;
  name: string;
  species: string;
  breed: string | null;
  sex: string | null;
  date_of_birth: string | null;
  location_region: string | null;
  bio: string | null;
  photo_urls: string[];
  profile_completed: boolean;
  health_status?: string | null;
  vaccination_status?: string | null;
  vaccination_details?: string | null;
  health_notes?: string | null;
};

type Tab = "Discover" | "Likes" | "Matches" | "Chat" | "Profile";
type ChatConversation = {
  id: string;
  match_id: string;
  otherAnimal: Animal;
  myAnimalId: string;
};

type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  message: string;
  created_at: string;
};
export default function MatchPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [userId, setUserId] = useState("");
  const [myAnimals, setMyAnimals] = useState<Animal[]>([]);
  const [selectedAnimal, setSelectedAnimal] = useState("");
  const [candidates, setCandidates] = useState<Animal[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("Discover");
  const [message, setMessage] = useState("");
  const [detail, setDetail] = useState<Animal | null>(null);
  const [matches, setMatches] = useState<Animal[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
const [conversations, setConversations] = useState<ChatConversation[]>([]);
const [activeConversation, setActiveConversation] = useState<ChatConversation | null>(null);
const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
const [chatDraft, setChatDraft] = useState("");
const [chatLoading, setChatLoading] = useState(false);
const [chatSending, setChatSending] = useState(false);
  const current = candidates[index];
const loadConversations = useCallback(async () => {
  if (!userId || myAnimals.length === 0) {
    setConversations([]);
    return;
  }

  setChatLoading(true);

  const animalIds = myAnimals.map((animal) => animal.id);

  const { data: matchRows, error: matchError } = await supabase
    .from("animal_matches")
    .select("id, animal_a_id, animal_b_id")
    .or(
      `animal_a_id.in.(${animalIds.join(",")}),animal_b_id.in.(${animalIds.join(",")})`
    );

  if (matchError) {
    setMessage("Could not load conversations: " + matchError.message);
    setChatLoading(false);
    return;
  }

  const rows = matchRows ?? [];
  const matchIds = rows.map((row) => row.id);

  if (matchIds.length === 0) {
    setConversations([]);
    setChatLoading(false);
    return;
  }

  const { data: conversationRows, error: conversationError } = await supabase
    .from("match_conversations")
    .select("id, match_id")
    .in("match_id", matchIds);

  if (conversationError) {
    setMessage("Could not load chats: " + conversationError.message);
    setChatLoading(false);
    return;
  }

  const otherAnimalIds = [
    ...new Set(
      rows.map((row) =>
        animalIds.includes(row.animal_a_id)
          ? row.animal_b_id
          : row.animal_a_id
      )
    ),
  ];

  const { data: otherAnimals, error: animalError } = await supabase
    .from("animal_profiles")
    .select("*")
    .in("id", otherAnimalIds);

  if (animalError) {
    setMessage("Could not load chat profiles: " + animalError.message);
    setChatLoading(false);
    return;
  }

  const animalMap = new Map(
    (otherAnimals ?? []).map((animal) => [animal.id, animal as Animal])
  );

  const result: ChatConversation[] = rows.flatMap((row) => {
    const conversation = (conversationRows ?? []).find(
      (item) => item.match_id === row.id
    );

    const myAnimalId = animalIds.includes(row.animal_a_id)
      ? row.animal_a_id
      : row.animal_b_id;

    const otherAnimalId = myAnimalId === row.animal_a_id
      ? row.animal_b_id
      : row.animal_a_id;

    const otherAnimal = animalMap.get(otherAnimalId);

    if (!conversation || !otherAnimal) return [];

    return [{
      id: conversation.id,
      match_id: row.id,
      otherAnimal,
      myAnimalId,
    }];
  });

  setConversations(result);
  setChatLoading(false);
}, [userId, myAnimals, supabase]);
  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const { data: auth, error: authError } =
      await supabase.auth.getUser();

    if (authError || !auth.user) {
      router.replace("/match/login");
      return;
    }

    const uid = auth.user.id;
    setUserId(uid);

    const { data: mine, error: mineError } = await supabase
      .from("animal_profiles")
      .select("*")
      .eq("owner_id", uid)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (mineError) {
      setMessage(mineError.message);
      setLoading(false);
      return;
    }

    const ownAnimals = (mine ?? []) as Animal[];
    setMyAnimals(ownAnimals);

    const ownAnimalIds = ownAnimals.map((animal) => animal.id);

    if (ownAnimalIds.length) {
      const idList = ownAnimalIds.join(",");

      const { data: matchRows, error: matchError } = await supabase
        .from("animal_matches")
        .select("animal_a_id, animal_b_id")
        .or(`animal_a_id.in.(${idList}),animal_b_id.in.(${idList})`);

      if (matchError) {
        setMessage("Could not load matches: " + matchError.message);
        setMatches([]);
      } else {
        const matchedAnimalIds = [...new Set(
          (matchRows ?? []).map((match) =>
            ownAnimalIds.includes(match.animal_a_id)
              ? match.animal_b_id
              : match.animal_a_id
          )
        )];

        if (matchedAnimalIds.length) {
          const { data: matchedAnimals, error: animalsError } =
            await supabase
              .from("animal_profiles")
              .select("*")
              .in("id", matchedAnimalIds);

          if (animalsError) {
            setMessage("Could not load matched profiles: " + animalsError.message);
            setMatches([]);
          } else {
            setMatches((matchedAnimals ?? []) as Animal[]);
          }
        } else {
          setMatches([]);
        }
      }
    } else {
      setMatches([]);
    }

    if (!ownAnimals.length) {
      setCandidates([]);
      setLoading(false);
      return;
    }

    const activeId = ownAnimals.some(a => a.id === selectedAnimal)
      ? selectedAnimal
      : ownAnimals[0].id;

    setSelectedAnimal(activeId);

    const source = ownAnimals.find(a => a.id === activeId)!;

    const { data: swipes } = await supabase
      .from("animal_swipes")
      .select("to_animal_id")
      .eq("from_animal_id", activeId);

    const excluded = [
      ...ownAnimals.map(a => a.id),
      ...(swipes ?? []).map(s => s.to_animal_id),
    ];

    let query = supabase
      .from("animal_profiles")
      .select("*")
      .eq("is_active", true)
      .eq("species", source.species)
      .eq("profile_completed", true)
      .neq("owner_id", uid);

    if (excluded.length) {
      query = query.not("id", "in", `(${excluded.join(",")})`);
    }

    const { data: others, error: otherError } = await query
      .order("created_at", { ascending: false })
      .limit(50);

    if (otherError) {
      setMessage(otherError.message);
    }

    const normaliseBreed = (value: string | null) =>
      (value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

    const compatible = ((others ?? []) as Animal[]).filter((animal) => {
      const sameBreed =
        normaliseBreed(animal.breed) === normaliseBreed(source.breed);

      const oppositeSex =
        (source.sex === "male" && animal.sex === "female") ||
        (source.sex === "female" && animal.sex === "male");

      return sameBreed && oppositeSex;
    });

    setCandidates(compatible);
    setIndex(0);
    setLoading(false);
  }, [supabase, router, selectedAnimal]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!activeConversation) return;

    const channel = supabase
      .channel(`chat-${activeConversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "match_messages",
          filter: `conversation_id=eq.${activeConversation.id}`,
        },
        () => {
          loadMessages(activeConversation.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConversation, supabase]);

  const calculateAge = (date: string | null) => {
    if (!date) return "Age not listed";
    const birth = new Date(date + "T00:00:00");
    const now = new Date();
    let years = now.getFullYear() - birth.getFullYear();
    let months = now.getMonth() - birth.getMonth();
    if (now.getDate() < birth.getDate()) months--;
    if (months < 0) {
      years--;
      months += 12;
    }
    return years > 0
      ? `${years} years${months ? `, ${months} months` : ""}`
      : `${months} months`;
  };

  async function swipe(action: "like" | "pass") {
    if (!current || !selectedAnimal || busy) return;

    setBusy(true);
    setMessage("");

    const { error } = await supabase.from("animal_swipes").insert({
      owner_id: userId,
      from_animal_id: selectedAnimal,
      to_animal_id: current.id,
      action,
    });

    if (error) {
      setMessage(error.message);
    } else if (action === "like") {
      const { data: reverseLike } = await supabase
        .from("animal_swipes")
        .select("id")
        .eq("from_animal_id", current.id)
        .eq("to_animal_id", selectedAnimal)
        .eq("action", "like")
        .maybeSingle();

      if (reverseLike) {
        setMatches(prev => [...prev, current]);
        setMessage(`It's a mutual like! ${current.name} and your animal matched.`);
      }
      setIndex(prev => prev + 1);
    } else {
      setIndex(prev => prev + 1);
    }

    setBusy(false);
  }
  async function loadMessages(conversationId: string) {
    setChatLoading(true);

    const { data, error } = await supabase
      .from("match_messages")
      .select("id, conversation_id, sender_id, message, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      setMessage("Could not load messages: " + error.message);
    } else {
      setChatMessages((data ?? []) as ChatMessage[]);
    }

    setChatLoading(false);
  }

  async function openConversation(conversation: ChatConversation) {
    setActiveConversation(conversation);
    setChatMessages([]);
    setChatDraft("");
    setTab("Chat");
    await loadMessages(conversation.id);
  }

  async function sendMessage() {
    const text = chatDraft.trim();

    if (!text || !activeConversation || !userId || chatSending) return;

    setChatSending(true);

    const { error } = await supabase.from("match_messages").insert({
      conversation_id: activeConversation.id,
      sender_id: userId,
      message: text,
    });

    if (error) {
      setMessage("Could not send message: " + error.message);
    } else {
      setChatDraft("");
      await loadMessages(activeConversation.id);
    }

    setChatSending(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/match/login");
  }

  const photo = current?.photo_urls?.[0];

  return (
    <main className={ui.appRoot} style={styles.page}>
      <div className={ui.forestAtmosphere} aria-hidden="true" />
      <header className={ui.forestHeader} style={styles.header}>
        <div>
          <a className={`${ui.forestButton} ${ui.headerHomeButton}`} href="/">
            ← Back to PETORA Home
          </a>
          <div style={styles.logo}>PETORA<span> MATCH</span></div>
          <div style={styles.tagline}>Meaningful connections. Responsible breeding.</div>
        </div>
        <button className={ui.forestButton} style={styles.profileButton} onClick={() => setTab("Profile")}>
          My Profile
        </button>
      </header>

      <div className={ui.forestContent} style={styles.content}>
        {tab === "Discover" && (
          <>
            <div style={styles.heading}>
              <div>
                <div style={styles.eyebrow}>YOUR NEXT CONNECTION</div>
                <h1 style={styles.title}>Discover</h1>
              </div>
              {myAnimals.length > 0 && (
                <select
                  value={selectedAnimal}
                  onChange={e => {
                    setSelectedAnimal(e.target.value);
                  }}
                  style={styles.select}
                >
                  {myAnimals.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {loading ? (
              <div className={`${ui.emptyState} ${ui.loadingState}`} style={styles.empty}>
                <span className={ui.loadingOrb} aria-hidden="true" />
                <p className={ui.emptyCopy}>Finding compatible companions…</p>
              </div>
            ) : myAnimals.length === 0 ? (
              <div className={`${ui.emptyState} ${ui.emptyStateHero}`} style={styles.empty}>
                <div className={ui.emptyGlyph} aria-hidden="true">✧</div>
                <p className={ui.panelKicker}>A THOUGHTFUL FIRST STEP</p>
                <h2 className={ui.emptyTitle}>Make room for a meaningful introduction</h2>
                <p className={ui.emptyCopy}>
                  Create a profile for your animal to discover compatible companions.
                </p>
                <button className={ui.forestButton} style={styles.goldButton}
                  onClick={() => router.push("/match/animals/new")}>
                  Add My Animal
                </button>
              </div>
            ) : !current ? (
              <div className={`${ui.emptyState} ${ui.emptyStateHero}`} style={styles.empty}>
                <div className={ui.emptyGlyph} aria-hidden="true">✦</div>
                <p className={ui.panelKicker}>THE CANOPY IS QUIET</p>
                <h2 className={ui.emptyTitle}>You&apos;ve met everyone for now</h2>
                <p className={ui.emptyCopy}>
                  New companions may arrive soon. Return when the forest has more stories to share.
                </p>
                <button className={ui.forestButton} style={styles.goldButton} onClick={loadData}>
                  Refresh Discover
                </button>
              </div>
            ) : (
              <>
                <div style={styles.counter}>
                  COMPANION {index + 1} · {candidates.length} PROFILES
                </div>
                <article className={ui.forestPhoto} style={styles.card}>
                  <div className={ui.forestPhotoFrame} style={styles.photoContainer}>
                    {photo ? (
                      <img src={photo} alt={current.name}
                        style={styles.photo} />
                    ) : (
                      <div style={styles.noPhoto}>🐾</div>
                    )}
                    <div style={styles.photoOverlay} />
                    <div style={styles.photoInfo}>
                      <div style={styles.species}>{current.species.toUpperCase()}</div>
                      <h2 style={styles.animalName}>{current.name}</h2>
                      <div style={styles.meta}>
                        {current.breed || "Breed not listed"}
                        {" · "}
                        {calculateAge(current.date_of_birth)}
                      </div>
                      {current.location_region && (
                        <div style={styles.location}>
                          📍 {current.location_region}
                        </div>
                      )}
                    </div>
                    <button className={ui.forestButton} type="button" aria-label={`View ${current.name}'s profile`} style={styles.infoButton}
                      onClick={() => setDetail(current)}>ⓘ</button>
                  </div>
                  <div style={styles.cardDescription}>
                    {current.bio || "Discover this animal and learn more about their personality."}
                  </div>
                </article>

                <div style={styles.actions}>
                  <button className={ui.forestButton} type="button" aria-label={`Pass on ${current.name}`} disabled={busy} onClick={() => swipe("pass")}
                    style={styles.passButton}>✕</button>
                  <button className={ui.forestButton} type="button" aria-label={`Like ${current.name}`} disabled={busy} onClick={() => swipe("like")}
                    style={styles.likeButton}>♥</button>
                </div>
                <div style={styles.actionLabels}>
                  <span>PASS</span><span>LIKE</span>
                </div>
              </>
            )}

            {message && <p style={styles.notice}>{message}</p>}
          </>
        )}

        {tab === "Likes" && (
          <section className={ui.forestSurface} style={styles.panel}>
            <header className={ui.panelHeading}>
              <p className={ui.panelKicker}>THE FIRST SPARK</p>
              <h1 className={ui.panelTitle}>Likes</h1>
              <p className={ui.panelSubtitle}>A thoughtful beginning to a lasting connection.</p>
            </header>
            <div className={ui.panelEmpty}>
              <span className={ui.emptyGlyphSmall} aria-hidden="true">♡</span>
              <p>Incoming likes will appear here when the likes interface is connected.</p>
            </div>
          </section>
        )}

        {tab === "Matches" && (
          <section className={ui.forestSurface} style={styles.panel}>
            <header className={ui.panelHeading}>
              <p className={ui.panelKicker}>A CONNECTION, RETURNED</p>
              <h1 className={ui.panelTitle}>Your Matches</h1>
              <p className={ui.panelSubtitle}>Thoughtful introductions, made mutual.</p>
            </header>
            {matches.length === 0
              ? (
                <div className={`${ui.panelEmpty} ${ui.emptyStateCompact}`}>
                  <span className={ui.emptyGlyphSmall} aria-hidden="true">✧</span>
                  <h2 className={ui.emptyTitle}>Your next connection begins with a like</h2>
                  <p>Mutual likes will appear here.</p>
                </div>
              ) : (
                <div className={ui.matchGrid}>
                  {matches.map(a => (
                    <button
                      className={`${ui.forestButton} ${ui.matchCard}`}
                      key={a.id}
                      type="button"
                      onClick={() => {
                        setGalleryIndex(0);
                        setDetail(a);
                      }}
                    >
                      <div className={ui.matchCardMedia}>
                        {a.photo_urls?.[0]
                          ? <img src={a.photo_urls[0]} alt={a.name} className={ui.matchCardPhoto} />
                          : <div className={ui.matchCardPlaceholder} aria-hidden="true">✧</div>}
                        <span className={ui.matchBadge}>MUTUAL MATCH</span>
                      </div>
                      <span className={ui.matchCardDetails}>
                        <strong>{a.name}</strong>
                        <span>{a.species} · {a.breed || "Breed not listed"}</span>
                        <span className={ui.matchCardLink}>View full profile <span aria-hidden="true">↗</span></span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
          </section>
        )}

        {tab === "Chat" && (
          <section className={ui.forestSurface} style={styles.panel}>
            <header className={ui.panelHeading}>
              <p className={ui.panelKicker}>PRIVATE CONVERSATIONS</p>
              <h1 className={ui.panelTitle}>Messages</h1>
              <p className={ui.panelSubtitle}>A more personal way to get acquainted.</p>
            </header>
            {!activeConversation ? (
              <>
                {chatLoading ? (
                  <div className={ui.panelEmpty}><span className={ui.loadingOrb} aria-hidden="true" /><p>Loading conversations…</p></div>
                ) : conversations.length === 0 ? (
                  <div className={`${ui.panelEmpty} ${ui.emptyStateCompact}`}>
                    <span className={ui.emptyGlyphSmall} aria-hidden="true">✦</span>
                    <h2 className={ui.emptyTitle}>A mutual match opens the conversation</h2>
                    <p>Your private conversations will appear here after a mutual match.</p>
                  </div>
                ) : (
                  <div className={ui.conversationList}>
                    {conversations.map((conversation) => (
                      <button
                        className={`${ui.forestButton} ${ui.conversationRow}`}
                        key={conversation.id}
                        type="button"
                        onClick={() => openConversation(conversation)}
                      >
                        {conversation.otherAnimal.photo_urls?.[0]
                          ? <img
                              src={conversation.otherAnimal.photo_urls[0]}
                              alt=""
                              className={ui.conversationAvatar}
                            />
                          : <span className={ui.conversationAvatarFallback} aria-hidden="true">✧</span>}
                        <span className={ui.conversationDetails}>
                          <strong>{conversation.otherAnimal.name}</strong>
                          <span>{conversation.otherAnimal.species} · {conversation.otherAnimal.breed || "Breed not listed"}</span>
                        </span>
                        <span className={ui.conversationArrow} aria-hidden="true">↗</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className={ui.chatPartnerHeader} style={styles.chatHeader}>
                  <button
                    type="button"
                    style={styles.chatBackButton}
                    onClick={() => {
                      setActiveConversation(null);
                      setChatMessages([]);
                    }}
                  >
                    ← All chats
                  </button>
                  <div className={ui.chatPartner}>
                    {activeConversation.otherAnimal.photo_urls?.[0]
                      ? <img
                          src={activeConversation.otherAnimal.photo_urls[0]}
                          alt=""
                          className={ui.chatPartnerPhoto}
                        />
                      : <span className={ui.chatPartnerPhotoFallback} aria-hidden="true">✧</span>}
                    <span className={ui.chatPartnerDetails}>
                      <strong>{activeConversation.otherAnimal.name}</strong>
                      <span>{activeConversation.otherAnimal.species} · {activeConversation.otherAnimal.breed || "Breed not listed"}</span>
                      <span className={ui.matchStatus}><i aria-hidden="true" /> MATCHED COMPANION</span>
                    </span>
                  </div>
                </div>

                <div className={ui.chatTimeline} style={styles.chatMessages}>
                  {chatLoading && chatMessages.length === 0 ? (
                    <p style={styles.muted}>Loading messages...</p>
                  ) : chatMessages.length === 0 ? (
                    <p style={styles.muted}>Start the conversation with a friendly hello.</p>
                  ) : (
                    chatMessages.map((item) => (
                      <div
                        key={item.id}
                        className={`${ui.messageBubble} ${item.sender_id === userId ? ui.messageBubbleOwn : ui.messageBubbleIncoming}`}
                        style={{
                          alignSelf: item.sender_id === userId ? "flex-end" : "flex-start",
                        }}
                      >
                        <div>{item.message}</div>
                        <time style={styles.chatTime}>
                          {new Date(item.created_at).toLocaleString()}
                        </time>
                      </div>
                    ))
                  )}
                </div>

                <form
                  className={ui.chatComposer}
                  style={styles.chatComposer}
                  onSubmit={(event) => {
                    event.preventDefault();
                    sendMessage();
                  }}
                >
                  <input
                    value={chatDraft}
                    onChange={(event) => setChatDraft(event.target.value)}
                    placeholder="Write a message..."
                    aria-label="Write a message"
                    maxLength={2000}
                    style={styles.chatInput}
                  />
                  <button
                    type="submit"
                    disabled={!chatDraft.trim() || chatSending}
                    className={ui.forestButton}
                    style={styles.goldButton}
                  >
                    {chatSending ? "Sending..." : "Send"}
                  </button>
                </form>
              </>
            )}
            {message && <p style={styles.notice}>{message}</p>}
          </section>
        )}

        {tab === "Profile" && (
          <section className={ui.forestSurface} style={styles.panel}>
            <header className={ui.panelHeading}>
              <p className={ui.panelKicker}>THE ONES YOU LOVE</p>
              <h1 className={ui.panelTitle}>My Animals</h1>
              <p className={ui.panelSubtitle}>Their stories, thoughtfully cared for.</p>
            </header>
            {myAnimals.map(a => (
              <div className={ui.profileRow} key={a.id} style={styles.matchRow}>
                {a.photo_urls?.[0] &&
                  <img src={a.photo_urls[0]} alt={a.name}
                    style={styles.matchPhoto} />}
                <div>
                  <strong>{a.name}</strong>
                  <div style={styles.muted}>{a.species} · {a.breed || "Breed not listed"}</div>
                  <button
                    className={ui.forestButton}
                    style={styles.goldButton}
                    onClick={() => router.push(`/match/animals/edit/${a.id}`)}
                  >
                    Edit Profile
                  </button>
                </div>
              </div>
            ))}
            <button className={ui.forestButton} style={styles.goldButton}
              onClick={() => router.push("/match/animals/new")}>
              + Add Another Animal
            </button>
            <button className={ui.forestButton} style={styles.logoutButton} onClick={logout}>Log Out</button>
          </section>
        )}
      </div>

      <nav className={ui.forestBottomNav} style={styles.nav}>
        {(["Discover", "Likes", "Matches", "Chat", "Profile"] as Tab[]).map((t, i) => (
          <button className={`${ui.forestNavButton} ${tab === t ? ui.forestNavButtonActive : ""}`} key={t} onClick={() => setTab(t)}
            aria-current={tab === t ? "page" : undefined}
            style={{ ...styles.navButton, color: tab === t ? "#1d5a3d" : "#879287", background: tab === t ? "#edf3eb" : "transparent", transform: tab === t ? "translateY(-1px)" : "none" }}>
            <span className={ui.navIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round">
                {i === 0 && <><circle cx="11" cy="11" r="6.4" /><path d="m16 16 4 4M11 7.5v7M7.5 11h7" /></>}
                {i === 1 && <path d="M20.2 8.8c0 4.2-8.2 10-8.2 10s-8.2-5.8-8.2-10a4.1 4.1 0 0 1 7.4-2.4l.8 1 .8-1a4.1 4.1 0 0 1 7.4 2.4Z" />}
                {i === 2 && <><path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z" /><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" /></>}
                {i === 3 && <><path d="M20 11.4a7.7 7.7 0 0 1-8 7.4 8.8 8.8 0 0 1-3.5-.7L4 20l1.3-3.7A7.1 7.1 0 0 1 4 12.6a7.7 7.7 0 0 1 8-7.4 7.7 7.7 0 0 1 8 6.2Z" /><path d="M8 11h.01M12 11h.01M16 11h.01" /></>}
                {i === 4 && <><circle cx="12" cy="8" r="3.3" /><path d="M5 20c.5-3.2 3.2-5.1 7-5.1s6.5 1.9 7 5.1" /></>}
              </svg>
            </span>
            <span>{t}</span>
          </button>
        ))}
      </nav>

      {detail && (
        <div style={styles.modalBackdrop} onClick={() => setDetail(null)}>
          <section
            style={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="animal-detail-title"
            onClick={e => e.stopPropagation()}
          >
            <button className={ui.forestButton} type="button" aria-label="Close animal profile" style={styles.close} onClick={() => setDetail(null)}>✕</button>
            {detail.photo_urls?.length ? (
              <div style={{ position: "relative", marginTop: 15 }}>
                <img
                  src={detail.photo_urls[galleryIndex] || detail.photo_urls[0]}
                  alt={`${detail.name} photo ${galleryIndex + 1}`}
                  style={styles.detailPhoto}
                />
                {detail.photo_urls.length > 1 && (
                  <>
                    <button
                      className={ui.forestButton}
                      type="button"
                      aria-label="Previous photo"
                      style={{ ...styles.galleryButton, left: 10 }}
                      onClick={() => setGalleryIndex(i =>
                        (i - 1 + detail.photo_urls.length) % detail.photo_urls.length
                      )}
                    >‹</button>
                    <button
                      className={ui.forestButton}
                      type="button"
                      aria-label="Next photo"
                      style={{ ...styles.galleryButton, right: 10 }}
                      onClick={() => setGalleryIndex(i =>
                        (i + 1) % detail.photo_urls.length
                      )}
                    >›</button>
                    <div style={styles.galleryCount}>
                      {galleryIndex + 1} / {detail.photo_urls.length}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div style={styles.noPhoto}>🐾 No photos uploaded</div>
            )}
            <h2 id="animal-detail-title">{detail.name}</h2>
            <p>{detail.species} · {detail.breed || "Breed not listed"}</p>
            <p>{detail.sex || "Sex not listed"} · {calculateAge(detail.date_of_birth)}</p>
            <p>📍 {detail.location_region || "Location not listed"}</p>
            <p>{detail.bio || "No biography provided."}</p>
            <h3>Health information</h3>
            <p>Owner-reported health: {detail.health_status || "Not provided"}</p>
            <p>Owner-reported vaccination: {detail.vaccination_status || "Not provided"}</p>
            {detail.vaccination_details && <p>Vaccination details: {detail.vaccination_details}</p>}
            {detail.health_notes && <p>Health notes: {detail.health_notes}</p>}
            {conversations.some((conversation) => conversation.otherAnimal.id === detail.id) && (
              <button
                style={styles.goldButton}
                onClick={() => {
                  const conversation = conversations.find(
                    (item) => item.otherAnimal.id === detail.id
                  );
                  if (conversation) {
                    setDetail(null);
                    openConversation(conversation);
                  }
                }}
              >
                Message Owner
              </button>
            )}
            <button className={ui.forestButton} style={styles.goldButton} onClick={() => setDetail(null)}>
              Close Profile
            </button>
          </section>
        </div>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "transparent",
    color: "#edf4e9",
    paddingBottom: 125,
    fontFamily: "'DM Sans', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  header: {
    maxWidth: 1180,
    margin: "auto",
    padding: "24px 0 18px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logo: { fontSize: 25, fontWeight: 900, letterSpacing: 2.2, color: "#f0e7ce" },
  tagline: { fontSize: 11, color: "#bdcbbd", marginTop: 6, letterSpacing: 0.5 },
  profileButton: {
    border: "1px solid rgba(226, 211, 165, 0.38)",
    background: "rgba(10, 48, 35, 0.76)",
    borderRadius: 999,
    padding: "11px 19px",
    color: "#f0d48f",
    fontWeight: 750,
    boxShadow: "0 8px 26px rgba(0, 0, 0, 0.2)",
    backdropFilter: "blur(18px)",
    cursor: "pointer",
  },
  content: { maxWidth: 940, margin: "auto", padding: "16px 0 34px" },
  heading: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 20 },
  eyebrow: { fontSize: 10, letterSpacing: 2.6, color: "#dfc47f", fontWeight: 850 },
  title: { fontFamily: "'Playfair Display', Georgia, serif", fontSize: 40, fontWeight: 500, lineHeight: 1.08, letterSpacing: -1, margin: "7px 0 0", color: "#f0f3e7" },
  select: { maxWidth: 190, padding: "12px 14px", border: "1px solid rgba(225, 235, 218, 0.2)", borderRadius: 14, background: "rgba(8, 39, 30, 0.82)", color: "#f0f3e7", fontWeight: 700, boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)" },
  counter: { fontSize: 10, letterSpacing: 2.1, color: "#c3d0bd", textAlign: "center", marginBottom: 13, fontWeight: 850 },
  card: { maxWidth: 690, margin: "0 auto", background: "rgba(8, 38, 29, 0.48)", borderRadius: 28, overflow: "hidden", boxShadow: "0 32px 88px rgba(0, 0, 0, 0.35), 0 0 46px rgba(196, 168, 104, 0.09)", border: "1px solid rgba(231, 239, 223, 0.2)", backdropFilter: "blur(18px)" },
  photoContainer: { position: "relative", height: "min(68vh, 650px)", minHeight: 430, background: "linear-gradient(135deg,#264a37,#102b22)" },
  photo: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  noPhoto: { display: "grid", placeItems: "center", height: "100%", minHeight: 300, fontSize: 90, color: "#d0d9c2", background: "radial-gradient(ellipse at 50% 20%, #527355, #163c2c 72%)" },
  photoOverlay: { position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(4, 18, 12, 0.02) 18%, rgba(3, 17, 12, 0.78) 100%)", pointerEvents: "none" },
  photoInfo: { position: "absolute", bottom: 28, left: 28, right: 64, color: "white", textShadow: "0 2px 18px rgba(0, 0, 0, 0.65)" },
  species: { display: "inline-flex", fontSize: 10, letterSpacing: 2.1, fontWeight: 900, padding: "7px 11px", borderRadius: 999, background: "rgba(7, 37, 27, 0.54)", color: "#f1dfaa", border: "1px solid rgba(244, 224, 168, 0.52)", backdropFilter: "blur(12px)" },
  animalName: { fontSize: 46, lineHeight: 1, letterSpacing: -1.5, margin: "12px 0 9px", fontWeight: 900 },
  meta: { fontSize: 15, fontWeight: 650 },
  location: { fontSize: 12, marginTop: 9, opacity: 0.95 },
  infoButton: { position: "absolute", right: 20, bottom: 24, border: "1px solid rgba(244, 224, 168, 0.62)", borderRadius: "50%", width: 46, height: 46, background: "rgba(9, 43, 32, 0.82)", color: "#f0d48f", fontSize: 21, fontWeight: 800, boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)", backdropFilter: "blur(12px)", cursor: "pointer" },
  cardDescription: { padding: "18px 24px 21px", fontSize: 14, lineHeight: 1.75, color: "#e1e8d9", background: "linear-gradient(135deg, rgba(223, 235, 211, 0.1), rgba(10, 43, 32, 0.42))", backdropFilter: "blur(18px)" },
  actions: { display: "flex", justifyContent: "center", alignItems: "center", gap: 25, marginTop: 22 },
  passButton: { width: 66, height: 66, borderRadius: "50%", border: "1px solid rgba(239, 215, 204, 0.38)", background: "rgba(13, 43, 33, 0.87)", color: "#f0b4a2", fontSize: 29, boxShadow: "0 10px 28px rgba(0, 0, 0, 0.3)", cursor: "pointer", transition: "transform .18s ease, box-shadow .18s ease" },
  likeButton: { width: 78, height: 78, borderRadius: "50%", border: "1px solid rgba(240, 216, 152, 0.72)", background: "linear-gradient(145deg,#d8bd76,#a98443)", color: "#173624", fontSize: 35, boxShadow: "0 12px 34px rgba(158, 125, 57, 0.33)", cursor: "pointer", transition: "transform .18s ease, box-shadow .18s ease" },
  actionLabels: { display: "flex", justifyContent: "center", gap: 72, marginTop: 9, fontSize: 9, letterSpacing: 2.2, color: "#bdcbbd", fontWeight: 900 },
  notice: { textAlign: "center", fontSize: 13, color: "#f0e4bc", lineHeight: 1.5, background: "rgba(17, 69, 48, 0.84)", border: "1px solid rgba(218, 191, 122, 0.26)", borderRadius: 14, padding: 12, marginTop: 16 },
  empty: { maxWidth: 660, margin: "14px auto 0", textAlign: "center", padding: "38px 28px", background: "linear-gradient(135deg, rgba(230, 239, 218, 0.11), rgba(12, 50, 35, 0.21) 55%, rgba(5, 30, 25, 0.34))", color: "#edf4e9", border: "1px solid rgba(232, 237, 218, 0.19)", borderRadius: 26, lineHeight: 1.7, boxShadow: "0 22px 65px rgba(0, 0, 0, 0.19)", backdropFilter: "blur(25px) saturate(135%)" },
  goldButton: { background: "linear-gradient(135deg,#ddc47d,#b99550)", color: "#183527", border: "1px solid rgba(237, 218, 162, 0.6)", borderRadius: 14, padding: "13px 20px", fontWeight: 850, cursor: "pointer", marginTop: 12, boxShadow: "0 8px 24px rgba(188, 154, 77, 0.24)" },
  panel: { background: "linear-gradient(132deg, rgba(223, 235, 211, 0.13), rgba(24, 69, 48, 0.27) 48%, rgba(4, 29, 24, 0.42))", color: "#edf4e9", border: "1px solid rgba(220, 235, 215, 0.2)", borderRadius: 26, padding: 28, minHeight: 250, lineHeight: 1.7, boxShadow: "0 28px 76px rgba(0, 0, 0, 0.25), inset 0 1px rgba(255, 255, 255, 0.11)", backdropFilter: "blur(24px) saturate(138%)" },
  matchRow: { display: "flex", alignItems: "center", gap: 14, padding: 15, borderBottom: "1px solid rgba(225, 235, 218, 0.12)", borderRadius: 16, color: "#edf4e9", transition: "background .18s ease" },
  matchPhoto: { width: 68, height: 68, flex: "0 0 68px", objectFit: "cover", borderRadius: 18, border: "1px solid rgba(231, 239, 223, 0.22)", boxShadow: "0 8px 22px rgba(0, 0, 0, 0.28)" },
  muted: { color: "#bdcbbd", fontSize: 12 },
  nav: { position: "fixed", bottom: 13, left: "50%", transform: "translateX(-50%)", width: "min(650px, calc(100% - 28px))", height: 76, background: "linear-gradient(145deg, rgba(22, 65, 47, 0.75), rgba(5, 27, 23, 0.78))", backdropFilter: "blur(26px) saturate(135%)", border: "1px solid rgba(228, 238, 219, 0.2)", borderRadius: 25, boxShadow: "0 18px 55px rgba(0, 0, 0, 0.36), inset 0 1px rgba(255, 255, 255, 0.08)", display: "flex", justifyContent: "center", zIndex: 5, padding: "5px 8px" },
  navButton: { flex: 1, maxWidth: 118, background: "transparent", border: 0, borderRadius: 18, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, fontSize: 10, fontWeight: 800, cursor: "pointer" },
  modalBackdrop: { position: "fixed", inset: 0, background: "rgba(2, 15, 11, 0.8)", backdropFilter: "blur(12px)", zIndex: 10, display: "grid", placeItems: "center", padding: 18 },
  modal: { position: "relative", width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", background: "linear-gradient(145deg, #123f2e, #08251d)", color: "#edf4e9", border: "1px solid rgba(220, 235, 215, 0.2)", borderRadius: 26, padding: 23, boxShadow: "0 30px 90px rgba(0, 0, 0, 0.6)" },
  close: { float: "right", border: "1px solid rgba(225, 235, 218, 0.18)", background: "rgba(4, 26, 19, 0.72)", color: "#f0d48f", borderRadius: "50%", width: 36, height: 36, fontSize: 17, cursor: "pointer" },
  detailPhoto: { width: "100%", height: 340, objectFit: "cover", borderRadius: 20, display: "block" },
  galleryButton: { position: "absolute", top: "50%", transform: "translateY(-50%)", border: "1px solid rgba(240, 216, 152, 0.55)", borderRadius: "50%", width: 42, height: 42, background: "rgba(8, 39, 30, 0.88)", color: "#f0d48f", fontSize: 27, cursor: "pointer", boxShadow: "0 8px 25px rgba(0, 0, 0, 0.3)" },
  galleryCount: { position: "absolute", bottom: 12, right: 12, background: "rgba(4, 20, 15, 0.86)", color: "#f0f3e7", padding: "6px 11px", borderRadius: 20, fontSize: 12, fontWeight: 750 },
  chatHeader: { display: "flex", alignItems: "center", gap: 18, marginBottom: 12, paddingBottom: 17, borderBottom: "1px solid rgba(232, 237, 218, 0.13)" },
  chatBackButton: { border: "1px solid rgba(225, 235, 218, 0.17)", background: "rgba(227, 236, 218, 0.07)", borderRadius: 12, padding: "10px 13px", color: "#e4d39e", cursor: "pointer", fontWeight: 650 },
  chatMessages: { display: "flex", flexDirection: "column", gap: 12, minHeight: 300, maxHeight: "54vh", overflowY: "auto", padding: "18px 3px" },
  chatTime: { display: "block", marginTop: 6, fontSize: 10, color: "rgba(225, 233, 215, 0.62)" },
  chatComposer: { display: "flex", gap: 9, alignItems: "center", marginTop: 3, padding: 7, border: "1px solid rgba(225, 235, 218, 0.14)", borderRadius: 17, background: "rgba(229, 238, 219, 0.07)", backdropFilter: "blur(16px)" },
  chatInput: { flex: 1, minWidth: 0, padding: "13px 15px", border: "1px solid transparent", borderRadius: 12, fontSize: 14, outline: "none", background: "transparent", color: "#f0f3e7" },
  logoutButton: { display: "block", marginTop: 18, padding: "12px 16px", background: "rgba(94, 40, 35, 0.25)", color: "#f1b6a8", border: "1px solid rgba(240, 165, 145, 0.25)", borderRadius: 12, cursor: "pointer", fontWeight: 750 },
};
