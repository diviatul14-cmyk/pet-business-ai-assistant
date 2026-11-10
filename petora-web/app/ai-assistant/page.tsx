
"use client";

import {
  FormEvent,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type SpeechRecognitionResultLike = {
  0: { transcript: string };
  isFinal: boolean;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const WELCOME_MESSAGE =
  "Hi! I'm PETORA AI, your intelligent companion for better animal care. Get helpful guidance on pet health, nutrition, behaviour, daily care and products for dogs, cats, birds, rabbits, fish and many other animals. How can I help your pet today?";

const SUGGESTIONS = [
  {
    title: "Dog care",
    question: "How can I keep my dog healthy and happy?",
    icon: "🐕",
  },
  {
    title: "Cat behaviour",
    question: "Why do cats purr?",
    icon: "🐈",
  },
  {
    title: "Aquarium care",
    question: "How do I maintain a healthy fish tank?",
    icon: "🐠",
  },
  {
    title: "Pet nutrition",
    question: "What should I consider when choosing pet food?",
    icon: "🥣",
  },
];

function ProductImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        role="img"
        aria-label="Product image unavailable"
        style={{
          width: "100%",
          maxWidth: "260px",
          minHeight: "100px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f2f5ef",
          color: "#718074",
          borderRadius: "12px",
          margin: "10px 0",
          fontSize: "13px",
        }}
      >
        Image unavailable
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || "PETORA product"}
      loading="lazy"
      onError={() => setFailed(true)}
      style={{
        display: "block",
        width: "100%",
        maxWidth: "260px",
        maxHeight: "220px",
        objectFit: "contain",
        borderRadius: "12px",
        margin: "10px 0",
      }}
    />
  );
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const tokens = text.split(/(!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\]|\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);

  return tokens.map((token, index) => {
    const image = token.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);

    if (image) {
      const [ , alt, src ] = image;

      // Only display local PETORA product images.
      if (src.startsWith("/products/") && !src.includes("..")) {
        return <ProductImage key={index} src={src} alt={alt} />;
      }

      return null;
    }

    const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);

    if (link) {
      const [, label, href] = link;

      // Never render placeholder or fabricated example.com links.
      if (
        href.startsWith("https://") &&
        !/example\.com/i.test(href) &&
        href !== "#"
      ) {
        return (
          <a
            key={index}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {label}
          </a>
        );
      }

      return label;
    }

    if (token.startsWith("**") && token.endsWith("**")) {
      return <strong key={index}>{token.slice(2, -2)}</strong>;
    }

    if (token.startsWith("`") && token.endsWith("`")) {
      return <code key={index}>{token.slice(1, -1)}</code>;
    }

    if (token.startsWith("*") && token.endsWith("*")) {
      return <em key={index}>{token.slice(1, -1)}</em>;
    }

    return token;
  });
}

function renderMarkdown(content: string): ReactNode {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const output: ReactNode[] = [];
  let paragraph: string[] = [];
  let bullets: string[] = [];
  let numbers: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;

    output.push(
      <p key={`p-${output.length}`}>
        {renderInlineMarkdown(paragraph.join(" "))}
      </p>,
    );
    paragraph = [];
  };

  const flushBullets = () => {
    if (bullets.length === 0) return;

    output.push(
      <ul key={`ul-${output.length}`}>
        {bullets.map((item, index) => (
          <li key={index}>{renderInlineMarkdown(item)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  const flushNumbers = () => {
    if (numbers.length === 0) return;

    output.push(
      <ol key={`ol-${output.length}`}>
        {numbers.map((item, index) => (
          <li key={index}>{renderInlineMarkdown(item)}</li>
        ))}
      </ol>,
    );
    numbers = [];
  };

  const flushBlocks = () => {
    flushParagraph();
    flushBullets();
    flushNumbers();
  };

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      // Keep adjacent list items in one list even when separated by blank lines.
      flushParagraph();
      return;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);

    if (heading) {
      flushBlocks();
      const headingContent = renderInlineMarkdown(heading[2]);
      const key = `heading-${output.length}`;

      if (heading[1].length === 1) {
        output.push(<h2 key={key}>{headingContent}</h2>);
      } else {
        output.push(<h3 key={key}>{headingContent}</h3>);
      }
      return;
    }

    const bullet = trimmed.match(/^(?:[-*•])\s+(.+)$/);

    if (bullet) {
      flushParagraph();
      flushNumbers();
      bullets.push(bullet[1]);
      return;
    }

    const numbered = trimmed.match(/^\d+[.)]\s+(.+)$/);

    if (numbered) {
      flushParagraph();
      flushBullets();
      numbers.push(numbered[1]);
      return;
    }

    flushBullets();
    flushNumbers();
    paragraph.push(trimmed);
  });

  flushBlocks();
  return <>{output}</>;
}

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: WELCOME_MESSAGE },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceBaseRef = useRef("");

  const [isListening, setIsListening] = useState(false);
  const [voiceLanguage, setVoiceLanguage] = useState("en-IN");
  const [speechError, setSpeechError] = useState("");

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    // Follow new content only when the owner is already near the bottom.
    if (distanceFromBottom < 160) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      recognitionRef.current?.abort();
    };
  }, []);

  function toggleVoiceTyping() {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    setSpeechError("");

    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };

    const SpeechRecognitionAPI =
      speechWindow.SpeechRecognition ??
      speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setSpeechError(
        "Voice typing is not supported by this browser. Try Chrome or Edge, or type your message instead.",
      );
      return;
    }

    try {
      const recognition = new SpeechRecognitionAPI();
      recognition.lang = voiceLanguage;
      recognition.continuous = true;
      recognition.interimResults = true;

      voiceBaseRef.current = input.trim()
        ? `${input.trimEnd()} `
        : "";
      recognitionRef.current = recognition;

      recognition.onresult = (event) => {
        let transcript = "";

        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0]?.transcript ?? "";
        }

        const combined = `${voiceBaseRef.current}${transcript}`;
        setInput(combined.slice(0, 2500));
      };

      recognition.onerror = (event) => {
        setIsListening(false);

        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setSpeechError(
            "Microphone access was blocked. Allow microphone access in your browser settings and try again.",
          );
        } else if (event.error === "no-speech") {
          setSpeechError("No speech was detected. Please try speaking again.");
        } else if (event.error !== "aborted") {
          setSpeechError(
            `Voice typing stopped (${event.error}). Please try again.`,
          );
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
      setIsListening(true);
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
      setSpeechError(
        "Could not start voice typing. Check microphone permissions and try again.",
      );
    }
  }

  async function askAI(question: string) {
    const cleanQuestion = question.trim();

    if (!cleanQuestion || isLoading) return;

    const conversation: Message[] = [
      ...messages,
      { role: "user", content: cleanQuestion },
    ];

    setMessages([
      ...conversation,
      { role: "assistant", content: "" },
    ]);
    setInput("");
    setError("");
    setIsLoading(true);

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const response = await fetch("/api/ai-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: conversation,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);

        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : "PETORA AI could not respond. Please try again.",
        );
      }

      if (!response.body) {
        throw new Error(
          "Streaming is not supported by this response. Please try again.",
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";

      while (true) {
        const { value, done } = await reader.read();

        if (done) break;

        answer += decoder.decode(value, { stream: true });

        setMessages([
          ...conversation,
          { role: "assistant", content: answer },
        ]);
      }

      answer += decoder.decode();

      if (!answer.trim()) {
        throw new Error(
          "PETORA AI returned an empty answer. Please try again.",
        );
      }

      setMessages([
        ...conversation,
        { role: "assistant", content: answer.trim() },
      ]);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }

      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.";

      setError(message);

      setMessages((current) => {
        const updated = [...current];

        if (
          updated.length > 0 &&
          updated[updated.length - 1].role === "assistant" &&
          !updated[updated.length - 1].content
        ) {
          updated.pop();
        }

        return updated;
      });
    } finally {
      if (abortRef.current === abortController) {
        abortRef.current = null;
        setIsLoading(false);
      }
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    recognitionRef.current?.stop();
    setIsListening(false);
    void askAI(input);
  }

  function startNewChat() {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setIsListening(false);
    setSpeechError("");
    abortRef.current?.abort();
    abortRef.current = null;

    setMessages([
      { role: "assistant", content: WELCOME_MESSAGE },
    ]);
    setInput("");
    setError("");
    setIsLoading(false);

    inputRef.current?.focus();
  }

  return (
    <main className="petora-ai">
      <div className="wildlife-scene" aria-hidden="true">
        <div className="scene-moon" />
        <div className="scene-haze haze-one" />
        <div className="scene-haze haze-two" />
        <div className="scene-haze haze-three" />
        <div className="scene-tree-line tree-line-back" />
        <div className="scene-tree-line tree-line-front" />
        <span className="wild-animal animal-wolf">🐺</span>
        <span className="wild-animal animal-deer">🦌</span>
        <span className="wild-animal animal-fox">🦊</span>
        <span className="wild-animal animal-tiger">🐅</span>
        <span className="wild-animal animal-eagle">🦅</span>
        <div className="scene-ground" />
        <div className="scene-vignette" />
      </div>
      <header className="topbar">
        <a href="/" className="brand" aria-label="PETORA home">
          <img
            src="/petora-logo.png"
            alt="PETORA — Pets Beyond Borders"
            className="brand-logo"
          />
          <span>
            <strong>PETORA</strong>
            <small>AI PET CARE</small>
          </span>
        </a>

        <a href="/" className="back-link">
          ← Back to shop
        </a>
      </header>

      <section className="workspace">
        <aside className="sidebar">
          <div>
            <img
              src="/petora-logo.png"
              alt="PETORA"
              className="assistant-icon brand-sidebar-logo"
            />
            <h2>PETORA AI</h2>
            <p className="muted">
              Your companion for thoughtful pet care.
            </p>
          </div>

          <button
            type="button"
            className="new-chat"
            onClick={startNewChat}
            disabled={isLoading}
          >
            <span>＋</span> New conversation
          </button>

          <div className="sidebar-note">
            <span>●</span>
            Local AI assistant
            <p>
              Helpful information for caring for your animal companions.
            </p>
          </div>

          <div className="sidebar-disclaimer">
            PETORA AI provides general information, not veterinary
            diagnosis or treatment.
          </div>
        </aside>

        <section
          className={`chat-panel ${
            messages.some((message) => message.role === "user")
              ? "has-conversation"
              : ""
          }`}
        >
          <div className="chat-heading">
            <div>
              <span className="eyebrow">YOUR PET CARE COMPANION</span>
              <h1>How can I help your pet?</h1>
              <p>
                Ask a question and watch the answer appear as it is
                generated.
              </p>
            </div>

            <div className="hero-right">
              <span className="online-status">
                <span /> Ready to help
              </span>

              <div className="vet-hero-visual" aria-label="Illustration representing veterinary pet care">
                <div className="vet-halo" />
                <div className="vet-doctor" aria-hidden="true">🧑‍⚕️</div>
                <div className="vet-pets" aria-hidden="true">
                  <span>🐕</span>
                  <span>🐈</span>
                  <span>🐇</span>
                  <span>🦜</span>
                </div>
                <span className="vet-leaf vet-leaf-one" aria-hidden="true">🌿</span>
                <span className="vet-leaf vet-leaf-two" aria-hidden="true">🍃</span>
              </div>

              <section className="care-info-card" aria-label="Pet care information">
                <div className="care-info-heading">
                  <span className="care-shield" aria-hidden="true">✓</span>
                  <div>
                    <strong>Pet Care Information</strong>
                    <p>Helpful guidance for happier, healthier pets.</p>
                  </div>
                </div>

                <ul>
                  <li><span aria-hidden="true">✓</span> Pet health and wellness</li>
                  <li><span aria-hidden="true">✓</span> Nutrition and diet advice</li>
                  <li><span aria-hidden="true">✓</span> Behaviour and training</li>
                  <li><span aria-hidden="true">✓</span> Care and product guidance</li>
                </ul>

                <p className="care-info-note">
                  General information only — not a veterinary diagnosis.
                </p>
              </section>
            </div>
          </div>

          <div className="conversation" ref={scrollRef}>
            {messages.map((message, index) => {
              const isUser = message.role === "user";
              const isCurrentAnswer =
                isLoading &&
                !isUser &&
                index === messages.length - 1;

              return (
                <article
                  key={`${index}-${message.role}`}
                  className={`message-row ${
                    isUser ? "user-row" : "assistant-row"
                  }`}
                >
                  {!isUser && (
                    <img
                      src="/petora-logo.png"
                      alt="PETORA"
                      className="message-avatar brand-message-logo"
                    />
                  )}

                  <div
                    className={`message-bubble ${
                      isUser ? "user-bubble" : "assistant-bubble"
                    }`}
                  >
                    {!isUser && (
                      <div className="message-label">PETORA AI</div>
                    )}

                    {message.content ? (
                      <div className="message-content">
                        {renderMarkdown(message.content)}
                        {isCurrentAnswer && (
                          <span
                            className="typing-cursor"
                            aria-label="Generating response"
                          />
                        )}
                      </div>
                    ) : isCurrentAnswer ? (
                      <div className="thinking">
                        <span />
                        <span />
                        <span />
                        <small>Thinking...</small>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}

            {error && (
              <div className="error-message" role="alert">
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    inputRef.current?.focus();
                  }}
                >
                  Try again
                </button>
              </div>
            )}
          </div>

          {messages.length === 1 && (
            <div className="suggestions">
              <p>TRY ASKING ABOUT</p>
              <div className="suggestion-grid">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    type="button"
                    className="suggestion-card"
                    key={suggestion.title}
                    disabled={isLoading}
                    onClick={() => void askAI(suggestion.question)}
                  >
                    <span className="suggestion-icon">
                      {suggestion.icon}
                    </span>
                    <span>
                      <strong>{suggestion.title}</strong>
                      <small>{suggestion.question}</small>
                    </span>
                    <span className="suggestion-arrow">↗</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="composer-area">
            <form className="composer" onSubmit={handleSubmit}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => {
                  setInput(event.target.value);
                  setSpeechError("");
                }}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder={
                  isListening
                    ? "Listening... speak now"
                    : "Ask anything about your pet..."
                }
                rows={2}
                maxLength={2500}
                disabled={isLoading}
                aria-label="Ask PETORA AI a question"
              />

              <select
                className="voice-language"
                value={voiceLanguage}
                onChange={(event) => setVoiceLanguage(event.target.value)}
                disabled={isListening || isLoading}
                aria-label="Voice typing language"
                title="Choose voice typing language"
              >
                <option value="en-IN">EN</option>
                <option value="hi-IN">HI</option>
              </select>

              <button
                type="button"
                className={`mic-button ${isListening ? "listening" : ""}`}
                onClick={toggleVoiceTyping}
                disabled={isLoading}
                aria-label={isListening ? "Stop voice typing" : "Start voice typing"}
                title={isListening ? "Stop voice typing" : "Start voice typing"}
              >
                {isListening ? "■" : "🎙"}
              </button>

              <button
                type="submit"
                className="send-button"
                disabled={isLoading || !input.trim()}
                aria-label="Send message"
              >
                {isLoading ? "…" : "↑"}
              </button>
            </form>

            {speechError && (
              <p className="speech-error" role="alert">
                {speechError}
              </p>
            )}

            {isListening && (
              <p className="listening-status" role="status">
                <span className="listening-dot" />
                Listening — speak clearly, then tap ■ to stop.
              </p>
            )}

            <div className="composer-footer">
              <span>Enter to send · Shift + Enter for a new line</span>
              <span>AI responses can make mistakes.</span>
            </div>
          </div>
        </section>
      </section>

      <style jsx>{`

        .petora-ai {
          --forest: #164b35;
          --forest-deep: #103b2a;
          --teal: #087f78;
          --gold: #c58a1c;
          --gold-soft: #f4e5bd;
          --ink: #1d3028;
          --muted: #63756a;
          --cream: #fbf8ef;
          --card: #fffefa;
          min-height: 100vh;
          color: var(--ink);
          background:
            radial-gradient(ellipse at 76% 18%, rgba(224, 239, 215, .72), transparent 30%),
            radial-gradient(ellipse at 8% 88%, rgba(233, 241, 222, .8), transparent 28%),
            var(--cream);
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          isolation: isolate;
        }

        .wildlife-scene { display: none; }

        .petora-ai * { box-sizing: border-box; }

        .topbar {
          position: relative;
          z-index: 2;
          height: 78px;
          padding: 0 clamp(18px, 4vw, 58px);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(255, 254, 249, .96);
          border-bottom: 1px solid #e9e4d5;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          color: var(--forest);
          text-decoration: none;
        }

        .brand-logo {
          display: block;
          width: 58px;
          height: 52px;
          object-fit: contain;
        }

        .brand strong, .brand small { display: block; }
        .brand strong { font-size: 17px; letter-spacing: 2px; font-weight: 850; }
        .brand small { margin-top: 4px; color: var(--gold); font-size: 9px; font-weight: 800; letter-spacing: 2.4px; }

        .back-link {
          padding: 10px 16px;
          border: 1px solid #d7e2d5;
          border-radius: 999px;
          color: var(--forest);
          background: #fffefa;
          font-size: 13px;
          font-weight: 750;
          text-decoration: none;
          transition: transform .2s ease, box-shadow .2s ease;
        }
        .back-link:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(27, 75, 49, .1); }

        .workspace {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: 258px minmax(0, 1fr);
          max-width: 1680px;
          height: calc(100vh - 78px);
          height: calc(100dvh - 78px);
          min-height: 0;
          margin: 0 auto;
        }

        .sidebar {
          display: flex;
          flex-direction: column;
          padding: 30px 22px 24px;
          background: linear-gradient(180deg, #f0f4e9 0%, #edf3e5 72%, #e7f0dd 100%);
          border-right: 1px solid #e0e8d9;
        }

        .assistant-icon.brand-sidebar-logo {
          display: block;
          width: 100%;
          max-width: 205px;
          height: 116px;
          padding: 9px;
          object-fit: contain;
          border: 1px solid #e8e6d9;
          border-radius: 20px;
          background: #fffefa;
          box-shadow: 0 9px 24px rgba(37, 73, 47, .08);
        }

        .sidebar h2 {
          margin: 18px 0 7px;
          color: var(--forest);
          font-size: 21px;
          font-weight: 850;
          letter-spacing: .4px;
        }

        .muted, .sidebar-note p {
          color: var(--muted);
          font-size: 13px;
          line-height: 1.7;
        }

        .new-chat {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          margin-top: 28px;
          padding: 14px 12px;
          border: 1px solid #d6e2d3;
          border-radius: 15px;
          background: linear-gradient(135deg, #fffefa, #f7fbf3);
          color: var(--forest);
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 5px 14px rgba(36, 75, 47, .06);
          transition: transform .2s ease, box-shadow .2s ease;
        }
        .new-chat:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 9px 20px rgba(36, 75, 47, .11); }
        .new-chat:disabled { opacity: .5; cursor: not-allowed; }
        .new-chat span { font-size: 21px; }

        .sidebar-note {
          margin-top: 30px;
          color: var(--forest);
          font-size: 12px;
          font-weight: 800;
        }
        .sidebar-note > span { color: #29965e; margin-right: 5px; }
        .sidebar-note p { margin: 9px 0 0; font-weight: 450; }

        .sidebar-disclaimer {
          margin-top: auto;
          padding: 16px 12px 0;
          border-top: 1px solid #d8e2d1;
          color: #718071;
          font-size: 11px;
          line-height: 1.65;
        }

        .chat-panel {
          display: flex;
          flex-direction: column;
          min-width: 0;
          min-height: 0;
          height: 100%;
          overflow: hidden;
          padding: 30px clamp(22px, 4.5vw, 64px) 18px;
        }

        /* Compact chat mode: hide the large welcome hero after the first question. */
        .chat-panel.has-conversation .chat-heading {
          display: none;
        }

        .chat-panel.has-conversation .conversation {
          padding-top: 18px;
        }

        .chat-heading {
          display: grid;
          grid-template-columns: minmax(260px, .95fr) minmax(420px, 1.05fr);
          align-items: center;
          gap: 24px;
          padding: 6px 0 25px;
          border-bottom: 1px solid #e8e3d5;
        }
        .chat-heading > div:first-child { min-width: 0; }

        .eyebrow {
          color: #a16f18;
          font-size: 11px;
          font-weight: 850;
          letter-spacing: 2.5px;
        }

        .chat-heading h1 {
          margin: 13px 0 12px;
          color: var(--forest);
          font-size: clamp(32px, 3.1vw, 46px);
          font-weight: 900;
          line-height: 1.12;
          letter-spacing: -1.8px;
          text-wrap: balance;
        }
        .chat-heading h1::after {
          content: "";
          display: block;
          width: 78px;
          height: 5px;
          margin-top: 15px;
          border-radius: 99px;
          background: linear-gradient(90deg, #d29a28, #e7c66d 55%, #218b72);
          box-shadow: 0 3px 8px rgba(180, 133, 35, .16);
        }
        .chat-heading p {
          margin: 0;
          color: #65766a;
          font-size: 14px;
          line-height: 1.7;
        }

        .hero-right {
          min-width: 0;
          display: grid;
          grid-template-columns: minmax(150px, .85fr) minmax(220px, 1.15fr);
          align-items: center;
          gap: 13px;
        }
        .hero-right > .online-status {
          grid-column: 1 / -1;
          justify-self: end;
          margin-bottom: -2px;
          color: #37694b;
          font-size: 12px;
          font-weight: 800;
        }
        .online-status > span {
          display: inline-block;
          width: 8px;
          height: 8px;
          margin-right: 7px;
          border-radius: 50%;
          background: #5bd6b0;
          box-shadow: 0 0 0 4px rgba(91, 214, 176, .13);
        }

        .vet-hero-visual {
          position: relative;
          isolation: isolate;
          min-width: 0;
          min-height: 205px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          overflow: hidden;
          border: 1px solid #dce7d1;
          border-radius: 110px 110px 24px 24px;
          background:
            radial-gradient(circle at 50% 35%, #fff8dc 0 24%, transparent 25%),
            linear-gradient(155deg, #fffdf5 0%, #e8f2df 55%, #d6eadf 100%);
          box-shadow: inset 0 0 30px rgba(255,255,255,.78), 0 10px 25px rgba(46, 83, 53, .08);
        }
        .vet-halo {
          position: absolute;
          z-index: -1;
          width: 170px;
          height: 170px;
          top: 13px;
          border-radius: 50%;
          background: radial-gradient(circle, #fff4ce 0%, #d7edce 72%);
        }
        .vet-doctor {
          font-size: clamp(64px, 5.2vw, 88px);
          line-height: 1.08;
          filter: drop-shadow(0 8px 5px rgba(36, 69, 44, .15));
          transform: translateY(4px);
        }
        .vet-pets {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 4px;
          margin-top: -2px;
          font-size: clamp(23px, 2.1vw, 33px);
          white-space: nowrap;
          filter: drop-shadow(0 4px 3px rgba(36, 69, 44, .12));
        }
        .vet-leaf { position: absolute; bottom: 12px; font-size: 25px; opacity: .85; }
        .vet-leaf-one { left: 8px; transform: rotate(-25deg); }
        .vet-leaf-two { right: 8px; transform: rotate(25deg); }

        .care-info-card {
          min-width: 0;
          padding: 17px 16px 13px;
          border: 1px solid #e8d6a5;
          border-radius: 20px;
          background: rgba(255, 254, 249, .97);
          box-shadow: 0 9px 25px rgba(91, 72, 31, .09);
        }
        .care-info-heading { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 12px; }
        .care-shield {
          display: grid;
          place-items: center;
          flex: 0 0 34px;
          width: 34px;
          height: 36px;
          border: 2px solid #d8b85e;
          border-radius: 11px 11px 15px 15px;
          background: linear-gradient(145deg, #2b8952, #17613b);
          color: #fff;
          font-size: 19px;
          font-weight: 900;
          box-shadow: 0 4px 9px rgba(31, 81, 51, .16);
        }
        .care-info-heading strong { display: block; color: var(--forest); font-size: 14px; line-height: 1.4; }
        .care-info-heading p { margin: 3px 0 0; color: #66776a; font-size: 11px; line-height: 1.5; }
        .care-info-card ul { display: grid; gap: 8px; list-style: none; margin: 0; padding: 0; }
        .care-info-card li { display: flex; align-items: flex-start; gap: 8px; color: #344a39; font-size: 11px; line-height: 1.45; }
        .care-info-card li > span {
          display: inline-grid;
          place-items: center;
          flex: 0 0 17px;
          width: 17px;
          height: 17px;
          border-radius: 50%;
          background: #e4f2df;
          color: #237345;
          font-size: 11px;
          font-weight: 900;
        }
        .care-info-note {
          margin: 12px 0 0;
          padding: 9px 0 0;
          border-top: 1px solid #eee7d5;
          color: #788071;
          font-size: 10px;
          line-height: 1.5;
        }

        .conversation {
          display: flex;
          flex-direction: column;
          gap: 22px;
          flex: 1 1 0;
          min-height: 0;
          max-height: none;
          overflow-y: auto;
          overscroll-behavior: contain;
          scrollbar-gutter: stable;
          padding: 25px 2px 18px;
          scroll-behavior: smooth;
        }

        /* Welcome screen: show the complete introduction without an inner scrollbar. */
        .chat-panel:not(.has-conversation) .conversation {
          flex: 0 0 auto;
          min-height: 0;
          max-height: none;
          overflow: visible;
          padding-top: 18px;
          padding-bottom: 10px;
        }

        /* Active chat: keep long conversations independently scrollable. */
        .chat-panel.has-conversation .conversation {
          flex: 1 1 0;
          min-height: 0;
          overflow-y: auto;
        }
        .message-row { display: flex; align-items: flex-start; gap: 11px; }
        .user-row { justify-content: flex-end; }
        .message-avatar.brand-message-logo {
          flex: 0 0 38px;
          width: 38px;
          height: 38px;
          padding: 4px;
          object-fit: contain;
          border: 1px solid #eee6d3;
          border-radius: 13px;
          background: #fffefa;
          box-shadow: 0 4px 12px rgba(45, 72, 46, .08);
        }
        .message-bubble {
          max-width: min(780px, 88%);
          padding: 16px 19px;
          border: 1px solid #e9e7dc;
          border-radius: 6px 18px 18px;
          background: var(--card);
          color: #293a30;
          font-size: 14px;
          line-height: 1.75;
          overflow-wrap: anywhere;
          box-shadow: 0 7px 20px rgba(49, 65, 43, .055);
        }
        .assistant-bubble { background: rgba(255, 254, 250, .97); }
        .user-bubble {
          border: 1px solid #1a8069;
          border-radius: 18px 6px 18px 18px;
          background: linear-gradient(135deg, #176a4a, #087f78);
          color: #fff;
          box-shadow: 0 7px 18px rgba(16, 105, 79, .18);
        }
        .user-bubble, .user-bubble * { color: #fff !important; -webkit-text-fill-color: #fff !important; }
        .message-label { margin-bottom: 6px; color: #a27625; font-size: 10px; font-weight: 850; letter-spacing: 1.2px; }
        .message-content { white-space: normal; overflow-wrap: anywhere; }
        .message-content p { margin: 0 0 11px; line-height: 1.75; }
        .message-content p:last-child { margin-bottom: 0; }
        .message-content h2 { margin: 19px 0 9px; color: var(--forest); font-size: 19px; line-height: 1.4; }
        .message-content h3 { margin: 15px 0 7px; color: var(--forest); font-size: 15px; line-height: 1.5; }
        .message-content ul, .message-content ol { margin: 9px 0 15px; padding-left: 24px; }
        .message-content li { margin: 6px 0; padding-left: 3px; line-height: 1.75; }
        .message-content strong { color: var(--forest); font-weight: 800; }
        .user-bubble .message-content strong { color: #fff !important; }
        .message-content code { padding: 2px 5px; border: 1px solid #e3e9df; border-radius: 5px; background: #f2f5ef; color: var(--forest); font-family: monospace; font-size: .92em; }
        .user-bubble .message-content code { background: rgba(255,255,255,.16); border-color: rgba(255,255,255,.25); color: #fff; }
        .typing-cursor { display: inline-block; width: 6px; height: 15px; margin-left: 3px; vertical-align: -2px; background: #c28b27; animation: blink 1s steps(2, start) infinite; }
        .thinking { display: flex; align-items: center; gap: 5px; min-height: 20px; }
        .thinking > span { width: 7px; height: 7px; border-radius: 50%; background: #25866b; animation: bounce 1s infinite ease-in-out; }
        .thinking > span:nth-child(2) { animation-delay: .15s; }
        .thinking > span:nth-child(3) { animation-delay: .3s; }
        .thinking small { margin-left: 6px; color: var(--muted); }

        .suggestions { margin: 3px 0 17px 49px; }
        .suggestions > p { margin: 0 0 11px; color: #a27625; font-size: 10px; font-weight: 850; letter-spacing: 2px; }
        .suggestion-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .suggestion-card {
          display: flex;
          align-items: center;
          gap: 11px;
          min-width: 0;
          padding: 13px;
          border: 1px solid #e8e5d9;
          border-radius: 15px;
          background: linear-gradient(135deg, #fffefa, #fbfaf3);
          color: var(--ink);
          text-align: left;
          cursor: pointer;
          box-shadow: 0 5px 15px rgba(45, 72, 46, .045);
          transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease;
        }
        .suggestion-card:hover:not(:disabled) { transform: translateY(-3px); border-color: #d5b86f; box-shadow: 0 9px 20px rgba(45, 72, 46, .09); }
        .suggestion-card:disabled { opacity: .6; cursor: not-allowed; }
        .suggestion-icon { flex: 0 0 auto; font-size: 24px; filter: drop-shadow(0 3px 4px rgba(100, 75, 30, .12)); }
        .suggestion-card strong, .suggestion-card small { display: block; }
        .suggestion-card strong { margin-bottom: 4px; color: var(--forest); font-size: 12px; font-weight: 850; }
        .suggestion-card small { color: #6f7c70; font-size: 11px; line-height: 1.45; }
        .suggestion-arrow { margin-left: auto; color: #bd861e; font-size: 18px; }

        .composer-area { padding-top: 10px; }
        .composer {
          display: flex;
          align-items: flex-end;
          gap: 10px;
          padding: 11px 12px;
          border: 1.5px solid #d8c18a;
          border-radius: 20px;
          background: #fffefa;
          box-shadow: 0 8px 24px rgba(77, 70, 41, .08), 0 0 0 4px rgba(220, 190, 119, .08);
        }
        .composer textarea {
          flex: 1;
          min-width: 0;
          min-height: 42px;
          max-height: 150px;
          resize: vertical;
          padding: 9px;
          border: 0;
          outline: none;
          background: transparent;
          color: #1d3028 !important;
          -webkit-text-fill-color: #1d3028 !important;
          caret-color: #087f78;
          font: inherit;
          font-size: 14px;
          line-height: 1.6;
          opacity: 1;
        }
        .composer textarea::placeholder { color: #778477 !important; -webkit-text-fill-color: #778477 !important; opacity: 1; }
        .voice-language, .mic-button {
          flex-shrink: 0;
          height: 42px;
          border: 1px solid #e0e5d9;
          border-radius: 12px;
          background: #f5f7ef;
          color: var(--forest);
          font: inherit;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }
        .voice-language { padding: 0 9px; }
        .mic-button { width: 42px; font-size: 18px; }
        .mic-button.listening { border-color: #df8d81; background: #fff0ed; color: #b83e32; animation: mic-pulse 1.2s ease-in-out infinite; }
        .mic-button:disabled, .voice-language:disabled { opacity: .45; cursor: not-allowed; animation: none; }
        .send-button {
          flex-shrink: 0;
          width: 43px;
          height: 43px;
          border: 0;
          border-radius: 13px;
          background: linear-gradient(145deg, #176a4a, #087f78);
          color: #fff;
          font-size: 25px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 5px 12px rgba(22, 105, 75, .2);
          transition: transform .2s ease, box-shadow .2s ease;
        }
        .send-button:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 16px rgba(22, 105, 75, .25); }
        .send-button:disabled { opacity: .48; cursor: not-allowed; }
        .speech-error { margin: 8px 3px 0; padding: 8px 11px; border: 1px solid #efc9c2; border-radius: 10px; background: #fff4f1; color: #984a40; font-size: 12px; line-height: 1.5; }
        .listening-status { display: flex; align-items: center; gap: 8px; margin: 8px 3px 0; color: var(--forest); font-size: 12px; }
        .listening-dot { width: 8px; height: 8px; flex-shrink: 0; border-radius: 50%; background: #d94f45; animation: mic-pulse 1.2s ease-in-out infinite; }
        .composer-footer { display: flex; justify-content: space-between; gap: 12px; padding: 10px 3px; color: #7b887d; font-size: 10px; }
        .error-message { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px; border: 1px solid #e8c9c4; border-radius: 10px; background: #fff5f3; color: #984a40; font-size: 12px; }
        .error-message button { flex-shrink: 0; border: 0; background: transparent; color: #984a40; font-weight: 800; cursor: pointer; }

        @keyframes blink { to { visibility: hidden; } }
        @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-4px); } }
        @keyframes mic-pulse { 50% { opacity: .45; } }

        @media (min-width: 1500px) {
          .chat-panel { padding-left: 64px; padding-right: 64px; }
        }

        @media (max-width: 1180px) {
          .workspace { grid-template-columns: 225px minmax(0, 1fr); }
          .sidebar { padding-left: 18px; padding-right: 18px; }
          .chat-panel { padding-left: 25px; padding-right: 25px; }
          .chat-heading { grid-template-columns: minmax(0, 1fr); }
          .hero-right { max-width: 650px; width: 100%; justify-self: end; }
        }

        @media (max-width: 760px) {
          .topbar { height: 66px; padding: 0 15px; }
          .brand-logo { width: 47px; height: 44px; }
          .brand strong { font-size: 14px; }
          .brand small { font-size: 8px; }
          .back-link { padding: 8px 11px; font-size: 11px; }
          .workspace { display: block; height: auto; min-height: calc(100vh - 66px); }
          .sidebar { display: none; }
          .chat-panel { height: auto; min-height: calc(100vh - 66px); overflow: visible; padding: 23px 15px 12px; }
          .chat-heading { display: flex; flex-direction: column; align-items: stretch; gap: 17px; padding: 0 0 19px; }
          .chat-heading h1 { font-size: clamp(29px, 8vw, 38px); letter-spacing: -1.2px; }
          .chat-heading p { font-size: 12px; }
          .hero-right { grid-template-columns: minmax(105px, .75fr) minmax(0, 1.25fr); gap: 9px; }
          .hero-right > .online-status { font-size: 11px; }
          .vet-hero-visual { min-height: 150px; }
          .vet-doctor { font-size: 55px; }
          .vet-pets { font-size: 21px; }
          .care-info-card { padding: 12px 11px 10px; border-radius: 15px; }
          .care-info-heading strong { font-size: 12px; }
          .care-info-heading p, .care-info-card li { font-size: 10px; }
          .care-info-card ul { gap: 6px; }
          .care-info-note { margin-top: 8px; padding-top: 7px; font-size: 9px; }
          .conversation { flex: none; max-height: none; min-height: 170px; overflow: visible; padding: 20px 0; gap: 17px; }
          .message-avatar.brand-message-logo { width: 31px; height: 31px; flex-basis: 31px; }
          .message-bubble { max-width: 93%; padding: 12px 14px; font-size: 13px; }
          .suggestions { margin: 0 0 15px; }
          .suggestion-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
          .suggestion-card { padding: 10px 9px; gap: 7px; }
          .suggestion-icon { font-size: 20px; }
          .suggestion-card strong { font-size: 11px; }
          .suggestion-card small { font-size: 10px; }
          .composer { gap: 7px; padding: 8px; border-radius: 16px; }
          .composer textarea { padding: 7px 5px; font-size: 13px; }
          .voice-language { height: 38px; padding: 0 6px; }
          .mic-button { width: 38px; height: 38px; }
          .send-button { width: 39px; height: 39px; }
          .composer-footer { font-size: 9px; }
        }

        @media (max-width: 420px) {
          .hero-right { grid-template-columns: 1fr; }
          .vet-hero-visual { min-height: 135px; border-radius: 80px 80px 18px 18px; }
          .vet-doctor { font-size: 48px; }
          .vet-pets { font-size: 20px; }
          .hero-right > .online-status { grid-column: 1; }
          .suggestion-grid { grid-template-columns: 1fr; }
          .composer-footer { flex-direction: column; gap: 3px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .petora-ai *, .petora-ai *::before, .petora-ai *::after {
            animation-duration: .01ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
            transition-duration: .01ms !important;
          }
        }

        /* PETORA AI: fit the complete desktop welcome screen into one viewport */
        @media (min-width: 761px) {
          .petora-ai {
            height: 100vh;
            height: 100dvh;
            min-height: 0;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }

          .topbar {
            flex: 0 0 78px;
          }

          .workspace {
            flex: 1 1 auto;
            height: auto;
            min-height: 0;
          }

          .chat-panel {
            flex: 1 1 auto;
            height: 100%;
            min-height: 0;
            overflow: hidden;
            padding-top: 16px;
            padding-bottom: 10px;
          }

          .chat-heading {
            flex: 0 0 auto;
            gap: 14px;
            padding-top: 0;
            padding-bottom: 12px;
          }

          .conversation {
            padding-top: 12px;
            padding-bottom: 8px;
            gap: 12px;
          }

          .chat-panel:not(.has-conversation) .conversation {
            flex: 0 0 auto;
            overflow: visible;
          }

          .message-bubble {
            padding: 12px 16px;
            font-size: 13px;
            line-height: 1.6;
          }

          .message-content p {
            line-height: 1.6;
          }

          .suggestions {
            flex: 0 0 auto;
            margin: 3px 0 6px 49px;
          }

          .suggestions > p {
            margin-bottom: 6px;
          }

          .suggestion-grid {
            gap: 8px;
          }

          .suggestion-card {
            min-height: 54px;
            padding: 9px 11px;
          }

          .suggestion-icon {
            font-size: 21px;
          }

          .composer-area {
            flex: 0 0 auto;
            padding-top: 5px;
          }

          .composer {
            padding: 7px 10px;
            gap: 8px;
          }

          .composer textarea {
            min-height: 38px;
            max-height: 90px;
          }

          .composer-footer {
            padding-top: 6px;
          }
        }

        /* Short desktop screens: use tighter spacing without hiding content */
        @media (min-width: 761px) and (max-height: 850px) {
          .chat-panel {
            padding-top: 10px;
            padding-bottom: 7px;
          }

          .chat-heading {
            padding-bottom: 8px;
          }

          .conversation {
            padding-top: 8px;
            padding-bottom: 5px;
          }

          .message-bubble {
            padding: 9px 13px;
          }

          .suggestion-card {
            min-height: 48px;
            padding: 7px 10px;
          }

          .composer-footer {
            padding-top: 4px;
          }
        }

        /* Keep mobile layouts naturally scrollable */
        @media (max-width: 760px) {
          .petora-ai {
            display: block;
            height: auto;
            min-height: 100vh;
            min-height: 100dvh;
            overflow: visible;
          }

          .topbar {
            flex: initial;
          }
        }
      `}
</style>
    </main>
  );
}
