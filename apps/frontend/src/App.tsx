import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, clearToken, getTokenPayload, hasToken, saveToken } from "./api";

const AppShell = ({ children }: { children: ReactNode }) => {
  const isAdmin = getTokenPayload().isAdmin ?? false;
  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>Meeting AI</h1>
        <nav>
          <Link to="/meetings">Встречи</Link>
          {isAdmin && <Link to="/admin/runs">Журнал обработок</Link>}
          {isAdmin && <Link to="/admin/models">Настройки ИИ</Link>}
          {isAdmin && <Link to="/admin/users">Пользователи</Link>}
        </nav>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
};

const resolveAuthError = (error: unknown): string => {
  if (error && typeof error === "object" && "response" in error) {
    const resp = (error as { response: { status: number; data?: { error?: string } } }).response;
    if (resp.status === 409) return "Этот email уже зарегистрирован. Войдите или используйте другой адрес.";
    if (resp.status === 401) return "Неверный email или пароль.";
    if (resp.status === 400) return "Проверьте правильность введённых данных (email, пароль минимум 6 символов).";
    if (resp.data?.error) return resp.data.error;
  }
  return "Не удалось выполнить запрос. Проверьте соединение и повторите.";
};

const AuthPage = ({ mode }: { mode: "login" | "register" }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("My workspace");

  const mutation = useMutation({
    mutationFn: async () => {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const payload =
        mode === "login"
          ? { email, password }
          : { email, password, name: name || undefined, workspaceName };
      const response = await api.post(endpoint, payload);
      return response.data as { token: string };
    },
    onSuccess: (data) => {
      saveToken(data.token);
      navigate("/meetings");
    },
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate();
  };

  return (
    <div className="auth-wrap">
      <form className="card" onSubmit={onSubmit}>
        <h2>{mode === "login" ? "Вход" : "Регистрация"}</h2>
        {mode === "register" && (
          <input placeholder="Имя (необязательно)" value={name} onChange={(e) => setName(e.target.value)} />
        )}
        <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input
          placeholder="Пароль (минимум 6 символов)"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {mode === "register" && (
          <input
            placeholder="Название пространства"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
          />
        )}
        <button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Загрузка..." : mode === "login" ? "Войти" : "Создать аккаунт"}
        </button>
        {mutation.isError && (
          <p className="error">{resolveAuthError(mutation.error)}</p>
        )}
        <div className="links-row">
          {mode === "login" ? <Link to="/register">Регистрация</Link> : <Link to="/login">Войти</Link>}
        </div>
      </form>
    </div>
  );
};

const MeetingMenu = ({ meetingId, onDeleted }: { meetingId: string; onDeleted: () => void }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const deleteMeeting = useMutation({
    mutationFn: async () => api.delete(`/me/meetings/${meetingId}`),
    onSuccess: onDeleted,
  });

  const menuItems = [
    {
      label: "Открыть",
      action: () => { setOpen(false); navigate(`/meetings/${meetingId}`); },
    },
    {
      label: "Переместить",
      action: () => { setOpen(false); alert("Переместить — в разработке"); },
    },
    {
      label: "Удалить",
      action: () => {
        setOpen(false);
        if (window.confirm("Удалить встречу? Это действие нельзя отменить.")) {
          deleteMeeting.mutate();
        }
      },
      danger: true,
    },
  ];

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={(e) => { e.preventDefault(); setOpen((v) => !v); }}
        style={{
          background: "none",
          border: "none",
          color: "var(--muted)",
          fontSize: "1.2em",
          padding: "0 6px",
          cursor: "pointer",
          lineHeight: 1,
        }}
        title="Действия"
      >
        ···
      </button>
      {open && (
        <div style={{
          position: "absolute",
          right: 0,
          top: "calc(100% + 4px)",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
          minWidth: 160,
          zIndex: 100,
          overflow: "hidden",
        }}>
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              style={{
                display: "block",
                width: "100%",
                background: "none",
                border: "none",
                borderRadius: 0,
                textAlign: "left",
                padding: "10px 16px",
                cursor: "pointer",
                color: item.danger ? "var(--danger)" : "var(--text)",
                fontSize: "0.9em",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const MeetingsPage = () => {
  const [title, setTitle] = useState("");
  const queryClient = useQueryClient();

  const meetings = useQuery({
    queryKey: ["meetings"],
    queryFn: async () => (await api.get("/me/meetings")).data,
  });

  const createMeeting = useMutation({
    mutationFn: async () => (await api.post("/me/meetings", { title })).data,
    onSuccess: () => {
      setTitle("");
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
  });

  return (
    <AppShell>
      <section className="card" style={{ paddingBottom: 4 }}>
        <h2 style={{ marginBottom: 10, textAlign: "center" }}>Зарегистрировать встречу</h2>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            createMeeting.mutate();
          }}
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Укажите дату и название встречи"
            style={{ flex: 1, minWidth: 320 }}
          />
          <button type="submit">Создать</button>
        </form>
        <div style={{ marginTop: 6, lineHeight: 1.5 }}>
          <p style={{ margin: 0, fontSize: "0.78em", color: "#9ca3af" }}>Примеры:</p>
          {[
            "20_03_2026 Встреча при Ген.директоре",
            "10_02_2025 Подготовка к 23 февраля",
            "30_03_2026 Финансовые результаты квартала",
            "11_04_2026 Стендап команды разработки",
          ].map((ex) => (
            <p
              key={ex}
              onClick={() => setTitle(ex)}
              style={{ margin: 0, fontSize: "0.78em", color: "#6b7280", cursor: "pointer" }}
            >
              {ex}
            </p>
          ))}
        </div>
      </section>

      <section className="card" style={{ flex: 1 }}>
        {meetings.isLoading && <p>Загрузка...</p>}
        {meetings.isError && <p className="error">Не удалось загрузить встречи</p>}
        {meetings.data?.map((meeting: any) => (
          <div key={meeting.id} className="list-row" style={{ gap: 8 }}>
            <Link
              to={`/meetings/${meeting.id}`}
              style={{ flex: 1, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none", color: "inherit" }}
            >
              {meeting.title}
            </Link>
            <span style={{ display: "flex", gap: 12, alignItems: "center", whiteSpace: "nowrap", color: "var(--muted)", fontSize: "0.82em", flexShrink: 0 }}>
              <span>{meeting.status}</span>
              <span>задачи: {meeting._count.tasks}</span>
              <span>спикеры: {meeting._count.speakers}</span>
            </span>
            <MeetingMenu
              meetingId={meeting.id}
              onDeleted={() => queryClient.invalidateQueries({ queryKey: ["meetings"] })}
            />
          </div>
        ))}
      </section>
    </AppShell>
  );
};

function parseSummary(text: string): { topics: string[]; decisions: string[] } | null {
  try {
    const parsed = JSON.parse(text);
    if (parsed && Array.isArray(parsed.topics)) return parsed as { topics: string[]; decisions: string[] };
  } catch { /* plain text fallback */ }
  return null;
}

const SummarySection = ({ meetingId, summary }: { meetingId: string; summary: any }) => {
  const queryClient = useQueryClient();

  const generate = useMutation({
    mutationFn: async () => {
      await api.post(`/me/meetings/${meetingId}/summary`);
      await api.post(`/me/meetings/${meetingId}/tasks/extract`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["meeting", meetingId] }),
  });

  const structured = summary ? parseSummary(summary.text) : null;

  return (
    <section className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>Саммари</h3>
        <button
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          style={{ fontSize: "0.85em", padding: "5px 12px" }}
        >
          {generate.isPending ? "Генерация..." : summary ? "Обновить саммари" : "Получить саммари"}
        </button>
      </div>
      {generate.isError && <p className="error">Не удалось получить саммари</p>}
      {!summary && <p className="muted" style={{ margin: 0 }}>Саммари ещё не сформировано</p>}
      {summary && structured && (
        <div>
          <p style={{ fontWeight: 600, marginBottom: 6, marginTop: 0 }}>Темы обсуждения</p>
          <ul style={{ margin: "0 0 14px 0", paddingLeft: 20 }}>
            {structured.topics.map((topic, i) => (
              <li key={i} style={{ marginBottom: 4, lineHeight: 1.5 }}>{topic}</li>
            ))}
          </ul>
          {structured.decisions.length > 0 && (
            <>
              <p style={{ fontWeight: 600, marginBottom: 6 }}>Принятые решения</p>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {structured.decisions.map((decision, i) => (
                  <li key={i} style={{ marginBottom: 4, lineHeight: 1.5 }}>{decision}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      {summary && !structured && (
        <p style={{ margin: 0, lineHeight: 1.7 }}>{summary.text}</p>
      )}
    </section>
  );
};

const TranscriptSection = ({
  meetingId,
  meetingData,
  transcriptLines,
}: {
  meetingId: string;
  meetingData: any;
  transcriptLines: string[];
}) => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draftSegments, setDraftSegments] = useState<Array<{ id: string; text: string; speakerId: string | null }>>([]);

  const startEdit = () => {
    const segments = meetingData?.transcript?.segments ?? [];
    setDraftSegments(segments.map((s: any) => ({
      id: s.id,
      text: s.text,
      speakerId: s.speaker?.id ?? null,
    })));
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const save = useMutation({
    mutationFn: async () =>
      api.patch(`/me/meetings/${meetingId}/transcript`, { segments: draftSegments }),
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["meeting", meetingId] });
    },
  });

  return (
    <section className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Транскрипция</h3>
        {!editing ? (
          <button onClick={startEdit} style={{ fontSize: "0.85em", padding: "5px 12px" }}>
            Редактировать транскрипцию
          </button>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              style={{ fontSize: "0.85em", padding: "5px 12px" }}
            >
              {save.isPending ? "Сохранение..." : "Сохранить"}
            </button>
            <button
              onClick={cancelEdit}
              style={{ fontSize: "0.85em", padding: "5px 12px", background: "none", color: "var(--text)", border: "1px solid var(--line)" }}
            >
              Отмена
            </button>
          </div>
        )}
      </div>

      {save.isError && <p className="error">Не удалось сохранить транскрипцию</p>}

      {editing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {draftSegments.map((seg, i) => {
            const original = meetingData?.transcript?.segments?.[i];
            const time = original
              ? new Date(original.startSec * 1000).toISOString().substring(11, 19)
              : "";
            const speakers: any[] = meetingData?.speakers ?? [];
            return (
              <div key={seg.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, paddingTop: 6, minWidth: 200, flexShrink: 0 }}>
                  <span style={{ fontSize: "0.75em", color: "var(--muted)", whiteSpace: "nowrap" }}>[{time}]</span>
                  <select
                    value={seg.speakerId ?? ""}
                    onChange={(e) => {
                      const updated = [...draftSegments];
                      updated[i] = { ...updated[i], speakerId: e.target.value || null };
                      setDraftSegments(updated);
                    }}
                    style={{ fontSize: "0.78em", padding: "3px 6px", borderRadius: 6, border: "1px solid var(--line)", maxWidth: 130 }}
                  >
                    <option value="">— нет —</option>
                    {speakers.map((sp: any) => (
                      <option key={sp.id} value={sp.id}>
                        {sp.confirmedName ?? sp.suggestedName ?? sp.autoLabel}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  value={seg.text}
                  onChange={(e) => {
                    const updated = [...draftSegments];
                    updated[i] = { ...updated[i], text: e.target.value };
                    setDraftSegments(updated);
                  }}
                  rows={Math.max(1, Math.ceil(seg.text.length / 80))}
                  style={{
                    flex: 1,
                    resize: "vertical",
                    fontFamily: "inherit",
                    fontSize: "0.9em",
                    padding: "6px 10px",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    lineHeight: 1.5,
                  }}
                />
              </div>
            );
          })}
        </div>
      ) : (
        transcriptLines.map((line: string, i: number) => (
          <p key={i} style={{ margin: "2px 0" }}>{line}</p>
        ))
      )}
    </section>
  );
};

const TranscribingAnimation = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
    <span style={{ color: "var(--muted)", fontSize: "0.9em" }}>Идёт транскрибация…</span>
    <div style={{
      width: "1em",
      height: "1em",
      border: "2px solid var(--accent-soft)",
      borderTopColor: "var(--accent)",
      borderRadius: "50%",
      animation: "spin 0.8s linear infinite",
      flexShrink: 0,
    }} />
  </div>
);

const TelegramRecipientPicker = ({
  selected,
  onChange,
}: {
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const contacts = useQuery({
    queryKey: ["telegram-contacts"],
    queryFn: async () => (await api.get("/me/meetings/telegram/contacts")).data as Array<{ id: string; chatId: string; name: string; username?: string; type: string }>,
    staleTime: 60_000,
  });

  const refresh = useMutation({
    mutationFn: async () => (await api.post("/me/meetings/telegram/contacts/refresh")).data,
    onSuccess: (data) => queryClient.setQueryData(["telegram-contacts"], data),
  });

  const toggle = (chatId: string) => {
    const next = new Set(selected);
    next.has(chatId) ? next.delete(chatId) : next.add(chatId);
    onChange(next);
  };

  const filtered = (contacts.data ?? []).filter((c) => {
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.username ?? "").toLowerCase().includes(q);
  });

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <p style={{ margin: 0, fontSize: "0.82em", color: "var(--muted)" }}>
          Выберите получателей:
        </p>
        <button
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
          style={{ fontSize: "0.78em", padding: "3px 10px", background: "none", color: "var(--accent)", border: "1px solid var(--accent)" }}
        >
          {refresh.isPending ? "Обновление..." : "Обновить список"}
        </button>
      </div>

      {contacts.isLoading && <p style={{ margin: 0, fontSize: "0.85em", color: "var(--muted)" }}>Загрузка...</p>}

      {!contacts.isLoading && contacts.data?.length === 0 && (
        <p style={{ margin: "4px 0 8px", fontSize: "0.85em", color: "var(--muted)" }}>
          Список пуст. Попросите получателей написать боту <strong>/start</strong> в Telegram, затем нажмите «Обновить список».
        </p>
      )}

      {(contacts.data?.length ?? 0) > 0 && (
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по имени или @username..."
          style={{ width: "100%", marginBottom: 6, fontSize: "0.88em", boxSizing: "border-box" }}
        />
      )}

      {filtered.map((contact) => (
        <label
          key={contact.chatId}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid var(--line)", cursor: "pointer" }}
        >
          <input
            type="checkbox"
            checked={selected.has(contact.chatId)}
            onChange={() => toggle(contact.chatId)}
            style={{ width: 16, height: 16, padding: 0, flexShrink: 0 }}
          />
          <span style={{ fontSize: "0.9em" }}>
            <strong>{contact.name}</strong>
            {contact.username && <span style={{ marginLeft: 6, color: "var(--muted)", fontSize: "0.85em" }}>@{contact.username}</span>}
            {contact.type !== "private" && <span style={{ marginLeft: 6, fontSize: "0.78em", color: "var(--muted)" }}>({contact.type})</span>}
          </span>
        </label>
      ))}

      {search && filtered.length === 0 && (
        <p style={{ margin: "4px 0", fontSize: "0.85em", color: "var(--muted)" }}>Никого не найдено</p>
      )}

      {refresh.isError && (
        <p className="error" style={{ marginTop: 6, fontSize: "0.82em" }}>
          Не удалось получить обновления от Telegram
        </p>
      )}
    </div>
  );
};

const MeetingDetailsPage = () => {
  const { meetingId = "" } = useParams();
  const queryClient = useQueryClient();
  const [question, setQuestion] = useState("");
  const [target, setTarget] = useState<"EMAIL" | "TELEGRAM">("EMAIL");
  const [destination, setDestination] = useState("");
  const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set());

  const meeting = useQuery({
    queryKey: ["meeting", meetingId],
    queryFn: async () => (await api.get(`/me/meetings/${meetingId}`)).data,
    refetchInterval: (query) =>
      query.state.data?.status === "PROCESSING" ? 3000 : false,
  });

  const ask = useMutation({
    mutationFn: async () => (await api.post(`/me/meetings/${meetingId}/questions`, { question })).data,
    onSuccess: () => {
      setQuestion("");
      queryClient.invalidateQueries({ queryKey: ["meeting", meetingId] });
    },
  });


  const exportMutation = useMutation({
    mutationFn: async () =>
      (await api.post(`/me/meetings/${meetingId}/export`, target === "TELEGRAM"
        ? { target, chatIds: Array.from(selectedChats) }
        : { target, destination },
      )).data,
  });

  const downloadTranscript = async () => {
    const response = await api.get(`/me/meetings/${meetingId}/transcript.txt`, { responseType: "blob" });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = `meeting-${meetingId}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return (await api.post(`/me/meetings/${meetingId}/upload`, formData)).data;
    },
    onSuccess: () => {
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: ["meeting", meetingId] });
    },
  });

  const meetingData = meeting.data;

  const transcriptLines = useMemo(
    () =>
      meetingData?.transcript?.segments?.map((segment: any) => {
        const date = new Date(segment.startSec * 1000).toISOString().substring(11, 19);
        const speaker = segment.speaker?.confirmedName ?? segment.speaker?.suggestedName ?? segment.speaker?.autoLabel ?? "Speaker";
        return `[${date}] ${speaker}: ${segment.text}`;
      }) ?? [],
    [meetingData],
  );

  const isProcessing = uploadMutation.isPending || meetingData?.status === "PROCESSING";

  return (
    <AppShell>
      {!meetingData && <p>Загрузка...</p>}
      {meeting.isError && <p className="error">Не удалось загрузить детали встречи</p>}
      {meetingData && (
        <>
          <section className="card">
            <h2>{meetingData.title}</h2>
            <p>
              Статус: {meetingData.status} {meetingData.processingError ? `· ${meetingData.processingError}` : ""}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <label style={{ cursor: "pointer" }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "8px 14px",
                    border: "1px solid var(--line)",
                    borderRadius: 10,
                    fontSize: "0.9em",
                    background: "var(--surface)",
                    cursor: "pointer",
                  }}
                >
                  Загрузить аудио/видео
                </span>
                <input
                  type="file"
                  style={{ display: "none" }}
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {selectedFile && (
                <span style={{ fontSize: "0.85em", color: "var(--muted)", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {selectedFile.name}
                </span>
              )}
              <button
                onClick={() => selectedFile && uploadMutation.mutate(selectedFile)}
                disabled={!selectedFile || uploadMutation.isPending}
              >
                {uploadMutation.isPending ? "Загрузка..." : "Транскрибировать"}
              </button>
              {isProcessing && <TranscribingAnimation />}
              <button
                onClick={downloadTranscript}
                style={{ marginLeft: "auto" }}
              >
                Скачать transcript.txt
              </button>
            </div>
            {uploadMutation.isError && <p className="error">Ошибка загрузки файла</p>}
          </section>


          <TranscriptSection meetingId={meetingId} meetingData={meetingData} transcriptLines={transcriptLines} />

          <SpeakersSection meetingId={meetingId} speakers={meetingData.speakers} />

          <SummarySection meetingId={meetingId} summary={meetingData.summary} />

          <TasksSection meetingId={meetingId} tasks={meetingData.tasks} />

          <section className="card">
            <h3 style={{ marginBottom: 12 }}>Чат по встрече</h3>
            {meetingData.questions.length > 0 && (
              <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                {meetingData.questions.map((item: any) => (
                  <div key={item.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <div style={{
                        background: "var(--accent)",
                        color: "#fff",
                        borderRadius: "14px 14px 4px 14px",
                        padding: "8px 14px",
                        maxWidth: "80%",
                        fontSize: "0.9em",
                        lineHeight: 1.5,
                      }}>
                        {item.question}
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-start" }}>
                      <div style={{
                        background: "var(--surface)",
                        border: "1px solid var(--line)",
                        borderRadius: "14px 14px 14px 4px",
                        padding: "8px 14px",
                        maxWidth: "80%",
                        fontSize: "0.9em",
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                      }}>
                        {item.answer}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {meetingData.questions.length === 0 && (
              <p className="muted" style={{ marginBottom: 12 }}>
                Задайте вопрос по содержанию встречи — AI ответит на основе транскрипции.
              </p>
            )}
            <form
              className="inline-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (question.trim()) ask.mutate();
              }}
            >
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Спросите что-нибудь о встрече..."
                disabled={ask.isPending}
                style={{ flex: 1 }}
              />
              <button type="submit" disabled={ask.isPending || !question.trim()}>
                {ask.isPending ? "..." : "Спросить"}
              </button>
            </form>
            {ask.isError && <p className="error" style={{ marginTop: 6 }}>Не удалось получить ответ</p>}
          </section>

          <section className="card">
            <h3>Экспорт</h3>
            <div className="inline-form" style={{ marginBottom: 8 }}>
              <select value={target} onChange={(e) => { setTarget(e.target.value as "EMAIL" | "TELEGRAM"); setSelectedChats(new Set()); }}>
                <option value="EMAIL">Email</option>
                <option value="TELEGRAM">Telegram</option>
              </select>
              {target === "EMAIL" && (
                <input
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="your@email.com"
                  style={{ flex: 1 }}
                />
              )}
              <button
                onClick={() => exportMutation.mutate()}
                disabled={exportMutation.isPending || (target === "TELEGRAM" && selectedChats.size === 0) || (target === "EMAIL" && !destination)}
              >
                {exportMutation.isPending ? "Отправка..." : `Отправить${target === "TELEGRAM" && selectedChats.size > 0 ? ` (${selectedChats.size})` : ""}`}
              </button>
            </div>
            {target === "TELEGRAM" && (
              <TelegramRecipientPicker selected={selectedChats} onChange={setSelectedChats} />
            )}
            {exportMutation.isError && (
              <p className="error" style={{ marginTop: 6 }}>
                {(exportMutation.error as any)?.response?.data?.error ?? "Ошибка экспорта"}
              </p>
            )}
            {exportMutation.isSuccess && <p style={{ color: "var(--accent)", marginTop: 6 }}>Экспорт выполнен</p>}
          </section>
        </>
      )}
    </AppShell>
  );
};

const SpeakersSection = ({ meetingId, speakers }: { meetingId: string; speakers: any[] }) => {
  const queryClient = useQueryClient();
  const [newLabel, setNewLabel] = useState("");
  const [newName, setNewName] = useState("");

  const addSpeaker = useMutation({
    mutationFn: async () =>
      (await api.post(`/me/meetings/${meetingId}/speakers`, {
        autoLabel: newLabel,
        confirmedName: newName || undefined,
      })).data,
    onSuccess: () => {
      setNewLabel("");
      setNewName("");
      queryClient.invalidateQueries({ queryKey: ["meeting", meetingId] });
    },
  });

  return (
    <section className="card">
      <h3 style={{ marginBottom: 12 }}>Спикеры</h3>
      {speakers.map((speaker: any) => (
        <SpeakerRow key={speaker.id} meetingId={meetingId} speaker={speaker} />
      ))}
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
        <p style={{ margin: "0 0 8px", fontSize: "0.85em", color: "var(--muted)" }}>Добавить спикера вручную:</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Метка (напр. Спикер 3)"
            style={{ flex: 1, minWidth: 160 }}
          />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Имя (необязательно)"
            style={{ flex: 1, minWidth: 160 }}
          />
          <button
            onClick={() => addSpeaker.mutate()}
            disabled={!newLabel || addSpeaker.isPending}
          >
            Добавить
          </button>
        </div>
        {addSpeaker.isError && <p className="error" style={{ marginTop: 6 }}>Не удалось добавить спикера</p>}
      </div>
    </section>
  );
};

const SpeakerRow = ({ meetingId, speaker }: { meetingId: string; speaker: any }) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState(speaker.confirmedName ?? "");
  const update = useMutation({
    mutationFn: async () =>
      (await api.patch(`/me/meetings/${meetingId}/speakers/${speaker.id}`, { confirmed_name: name || null })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["meeting", meetingId] }),
  });
  return (
    <div className="list-row">
      <div>
        <strong>{speaker.autoLabel}</strong>
        <p>suggested: {speaker.suggestedName ?? "-"}</p>
      </div>
      <div className="inline-form compact">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя" />
        <button onClick={() => update.mutate()}>Сохранить</button>
      </div>
    </div>
  );
};

const TasksSection = ({ meetingId, tasks }: { meetingId: string; tasks: any[] }) => {
  const queryClient = useQueryClient();
  const [newText, setNewText] = useState("");
  const [newAssignee, setNewAssignee] = useState("");
  const [newDueDate, setNewDueDate] = useState("");

  const createTask = useMutation({
    mutationFn: async () =>
      (await api.post(`/me/meetings/${meetingId}/tasks`, {
        text: newText,
        assignee: newAssignee || undefined,
        dueDate: newDueDate || undefined,
      })).data,
    onSuccess: () => {
      setNewText("");
      setNewAssignee("");
      setNewDueDate("");
      queryClient.invalidateQueries({ queryKey: ["meeting", meetingId] });
    },
  });

  return (
    <section className="card">
      <h3 style={{ margin: "0 0 10px" }}>Задачи</h3>
      {tasks.length > 0 && (
        <div className="task-grid" style={{ color: "var(--muted)", fontSize: "0.78em", fontWeight: 600, paddingBottom: 4, borderBottom: "1px solid var(--line)", marginBottom: 4 }}>
          <span>Задача</span>
          <span>Ответственный</span>
          <span>Срок</span>
          <span />
          <span />
        </div>
      )}
      {tasks.length === 0 && (
        <p className="muted" style={{ margin: "0 0 12px" }}>Задачи будут извлечены при нажатии «Получить саммари»</p>
      )}
      {tasks.map((task: any) => (
        <TaskRow key={task.id} meetingId={meetingId} task={task} />
      ))}
      <div className="task-grid" style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--line)" }}>
        <input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Новая задача"
        />
        <input
          value={newAssignee}
          onChange={(e) => setNewAssignee(e.target.value)}
          placeholder="Ответственный"
        />
        <input
          value={newDueDate}
          onChange={(e) => setNewDueDate(e.target.value)}
          placeholder="Срок"
        />
        <button
          onClick={() => createTask.mutate()}
          disabled={!newText || createTask.isPending}
        >
          {createTask.isPending ? "..." : "+ Добавить"}
        </button>
        <span />
      </div>
      {createTask.isError && <p className="error" style={{ marginTop: 6 }}>Не удалось создать задачу</p>}
    </section>
  );
};

const TaskRow = ({ meetingId, task }: { meetingId: string; task: any }) => {
  const queryClient = useQueryClient();
  const [text, setText] = useState(task.finalText);
  const [assignee, setAssignee] = useState(task.finalAssignee ?? "");
  const [dueDate, setDueDate] = useState(task.finalDueDate ?? "");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const update = useMutation({
    mutationFn: async () =>
      (await api.patch(`/me/meetings/${meetingId}/tasks/${task.id}`, {
        text_final: text,
        assignee_final: assignee,
        due_date_final: dueDate,
        done: task.done,
      })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["meeting", meetingId] }),
  });

  const remove = useMutation({
    mutationFn: async () => api.delete(`/me/meetings/${meetingId}/tasks/${task.id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["meeting", meetingId] }),
  });

  return (
    <div className="task-grid">
      <input value={text} onChange={(e) => setText(e.target.value)} />
      <input value={assignee} onChange={(e) => setAssignee(e.target.value)} />
      <input value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      <button onClick={() => update.mutate()} disabled={update.isPending}>
        {update.isPending ? "..." : "Сохранить"}
      </button>
      <div ref={menuRef} style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          style={{ background: "none", border: "none", color: "var(--muted)", fontSize: "1.2em", padding: "0 6px", cursor: "pointer", lineHeight: 1 }}
        >
          ···
        </button>
        {menuOpen && (
          <div style={{
            position: "absolute", right: 0, top: "calc(100% + 2px)",
            background: "var(--surface)", border: "1px solid var(--line)",
            borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
            minWidth: 120, zIndex: 100, overflow: "hidden",
          }}>
            <button
              onClick={() => {
                setMenuOpen(false);
                if (window.confirm("Удалить задачу?")) remove.mutate();
              }}
              style={{ display: "block", width: "100%", background: "none", border: "none", borderRadius: 0, textAlign: "left", padding: "9px 14px", cursor: "pointer", color: "var(--danger)", fontSize: "0.88em" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#fef2f2")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              Удалить
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const AdminRunsPage = () => {
  const [status, setStatus] = useState("");
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [hasErrors, setHasErrors] = useState("");

  const runs = useQuery({
    queryKey: ["admin-runs", status, userId, userEmail, from, to, hasErrors],
    queryFn: async () =>
      (
        await api.get("/admin/runs", {
          params: {
            status: status || undefined,
            userId: userId || undefined,
            userEmail: userEmail || undefined,
            from: from ? new Date(from).toISOString() : undefined,
            to: to ? new Date(to).toISOString() : undefined,
            hasErrors: hasErrors || undefined,
          },
        })
      ).data,
    refetchInterval: 5000,
  });

  return (
    <AppShell>
      <section className="card">
        <h2>Run filters</h2>
        <div className="inline-form">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Любой статус</option>
            <option value="pending">pending</option>
            <option value="running">running</option>
            <option value="completed">completed</option>
            <option value="failed">failed</option>
            <option value="partial_failed">partial_failed</option>
          </select>
          <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="User id" />
          <input value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="User email" />
          <label className="inline-form compact">
            <span>From</span>
            <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="inline-form compact">
            <span>To</span>
            <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <select value={hasErrors} onChange={(e) => setHasErrors(e.target.value)}>
            <option value="">Errors any</option>
            <option value="true">Only with errors</option>
            <option value="false">Only without errors</option>
          </select>
        </div>
      </section>

      <section className="card">
        <h2>Processing runs</h2>
        {runs.isLoading && <p>Loading...</p>}
        {runs.isError && <p className="error">Failed to load runs</p>}
        {runs.data?.map((run: any) => (
          <div className="list-row" key={run.id}>
            <div>
              <strong>{run.meeting.title}</strong> <span className="muted">({run.status})</span>
              <p>
                user: {run.user.email} · model: {run.provider ?? "-"}/{run.model ?? "-"} · cost: {run.totalCost}
              </p>
              <p>
                created: {new Date(run.createdAt).toLocaleString()} · steps: {run._count.steps}
                {run.errorMessage ? ` · error: ${run.errorMessage}` : ""}
              </p>
            </div>
            <Link to={`/admin/runs/${run.id}`}>Details</Link>
          </div>
        ))}
      </section>
    </AppShell>
  );
};

const AdminRunDetailsPage = () => {
  const { runId = "" } = useParams();
  const queryClient = useQueryClient();
  const details = useQuery({
    queryKey: ["admin-run", runId],
    queryFn: async () => (await api.get(`/admin/runs/${runId}`)).data,
    refetchInterval: 5000,
  });

  const rerun = useMutation({
    mutationFn: async () => (await api.post(`/admin/runs/${runId}/rerun`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-run", runId] });
      queryClient.invalidateQueries({ queryKey: ["admin-runs"] });
    },
  });

  return (
    <AppShell>
      <section className="card">
        <h2>Run details</h2>
        <button
          onClick={() => rerun.mutate()}
          disabled={rerun.isPending}
        >
          Rerun
        </button>
        {details.data && (
          <div className="details-grid">
            <p>Meeting: {details.data.meeting.title}</p>
            <p>User: {details.data.user.email}</p>
            <p>Status: {details.data.status}</p>
            <p>Cost: {details.data.totalCost}</p>
            <p>Duration: {details.data.durationMs ?? 0}ms</p>
            <p>Транскрипция: {details.data.transcriptionProvider ?? "-"}/{details.data.transcriptionModel ?? "-"}</p>
            <p>Постобработка: {details.data.postprocessingProvider ?? "-"}/{details.data.postprocessingModel ?? "-"}</p>
            {details.data.errorMessage && <p className="error">Run error: {details.data.errorMessage}</p>}
          </div>
        )}
        {details.isError && <p className="error">Failed to load run details</p>}
        {details.data?.steps?.map((step: any) => (
          <div className="list-row" key={step.id}>
            <div>
              <strong>{step.stepName}</strong>
              <p>
                {step.status} · {step.provider}/{step.model} · {step.durationMs}ms · cost: {step.cost}
              </p>
              {step.errorMessage && <p className="error">{step.errorMessage}</p>}
            </div>
          </div>
        ))}
      </section>
    </AppShell>
  );
};

type SttPreset = {
  name: string;
  provider: string;
  model: string;
  tier: "free" | "paid";
  price: string;
  description: string;
  envVar: string;
  diarization: boolean;
  setupNote?: string;
};

const STT_PRESETS: SttPreset[] = [
  {
    name: "Groq Whisper Large V3 Turbo",
    provider: "groq",
    model: "whisper-large-v3-turbo",
    tier: "free",
    price: "Бесплатно",
    description: "Whisper через Groq API. Очень быстро. Лимит: 20 req/мин, 7200 сек/час.",
    envVar: "GROQ_API_KEY",
    diarization: false,
  },
  {
    name: "Gladia Solaria-1",
    provider: "gladia",
    model: "solaria-1",
    tier: "free",
    price: "Бесплатно (10 ч/мес)",
    description: "Точная транскрипция с диаризацией спикеров. Хорошо работает с русским.",
    envVar: "GLADIA_API_KEY",
    diarization: true,
  },
  {
    name: "Whisper Local (faster-whisper-server)",
    provider: "whisper-local",
    model: "large-v3",
    tier: "free",
    price: "Бесплатно",
    description: "Локальный Whisper на вашем сервере. Полная конфиденциальность данных.",
    envVar: "WHISPER_LOCAL_URL",
    diarization: false,
    setupNote: "docker run -p 8080:8080 fedirz/faster-whisper-server:latest-cpu",
  },
  {
    name: "Ollama (LocalAI / Whisper)",
    provider: "ollama",
    model: "whisper",
    tier: "free",
    price: "Бесплатно",
    description: "Через локальный Ollama/LocalAI с поддержкой STT. Требует совместимой сборки.",
    envVar: "OLLAMA_BASE_URL",
    diarization: false,
    setupNote: "docker run -p 8080:8080 localai/localai:latest whisper-base",
  },
  {
    name: "Google Gemini 2.0 Flash",
    provider: "gemini",
    model: "gemini-2.0-flash",
    tier: "paid",
    price: "~$0.01/час",
    description: "Мультимодальная модель с диаризацией спикеров. Лучшее качество на русском среди всех провайдеров.",
    envVar: "GEMINI_API_KEY",
    diarization: true,
  },
  {
    name: "OpenAI Whisper",
    provider: "openai",
    model: "whisper-1",
    tier: "paid",
    price: "$0.006/мин",
    description: "Официальный Whisper API. Надёжно, проверено временем.",
    envVar: "OPENAI_API_KEY",
    diarization: false,
  },
  {
    name: "Deepgram Nova-3",
    provider: "deepgram",
    model: "nova-3",
    tier: "paid",
    price: "$0.0077/час",
    description: "Новейшая модель Deepgram. Синхронный ответ, диаризация спикеров, дешевле Nova-2.",
    envVar: "DEEPGRAM_API_KEY",
    diarization: true,
  },
  {
    name: "AssemblyAI Universal-2",
    provider: "assemblyai",
    model: "best",
    tier: "paid",
    price: "$0.0062/мин",
    description: "Высокая точность, диаризация, 99+ языков. Асинхронная обработка.",
    envVar: "ASSEMBLYAI_API_KEY",
    diarization: true,
  },
];

const SttPresetSelector = ({
  activeProvider,
  activeModel,
  onActivate,
  isPending,
}: {
  activeProvider: string;
  activeModel: string;
  onActivate: (provider: string, model: string) => void;
  isPending: boolean;
}) => {
  const [customProvider, setCustomProvider] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const freePresets = STT_PRESETS.filter((p) => p.tier === "free");
  const paidPresets = STT_PRESETS.filter((p) => p.tier === "paid");

  const renderPreset = (preset: SttPreset) => {
    const isActive = preset.provider === activeProvider && preset.model === activeModel;
    return (
      <div
        key={preset.provider + preset.model}
        style={{
          border: isActive ? "2px solid #3b82f6" : "1px solid #e5e7eb",
          borderRadius: 8,
          padding: "12px 14px",
          marginBottom: 8,
          background: isActive ? "#eff6ff" : "#fff",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <strong style={{ fontSize: "0.95em" }}>{preset.name}</strong>
            <span style={{
              fontSize: "0.72em",
              fontWeight: 600,
              padding: "2px 7px",
              borderRadius: 99,
              background: preset.tier === "free" ? "#dcfce7" : "#fef9c3",
              color: preset.tier === "free" ? "#16a34a" : "#92400e",
            }}>
              {preset.price}
            </span>
            {preset.diarization && (
              <span style={{ fontSize: "0.72em", padding: "2px 7px", borderRadius: 99, background: "#e0e7ff", color: "#3730a3" }}>
                диаризация
              </span>
            )}
            {isActive && (
              <span style={{ fontSize: "0.72em", padding: "2px 7px", borderRadius: 99, background: "#dbeafe", color: "#1d4ed8", fontWeight: 700 }}>
                АКТИВНА
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: "0.82em", color: "#6b7280" }}>{preset.description}</p>
          <p style={{ margin: "4px 0 0", fontSize: "0.78em", color: "#9ca3af" }}>
            Требует: <code style={{ background: "#f3f4f6", padding: "1px 5px", borderRadius: 4 }}>{preset.envVar}</code>
            {preset.setupNote && (
              <span> · <code style={{ background: "#f3f4f6", padding: "1px 5px", borderRadius: 4 }}>{preset.setupNote}</code></span>
            )}
          </p>
        </div>
        <button
          onClick={() => onActivate(preset.provider, preset.model)}
          disabled={isActive || isPending}
          style={{ flexShrink: 0, padding: "6px 14px", fontSize: "0.85em" }}
        >
          {isActive ? "Активна" : "Активировать"}
        </button>
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <strong>Активная модель: </strong>
          <code style={{ background: "#f3f4f6", padding: "2px 8px", borderRadius: 4 }}>
            {activeProvider}/{activeModel}
          </code>
        </div>
        <button
          onClick={() => setShowCustom((v) => !v)}
          style={{ fontSize: "0.82em", padding: "4px 10px" }}
        >
          {showCustom ? "Скрыть" : "Ввести вручную"}
        </button>
      </div>

      {showCustom && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
          <input value={customProvider} onChange={(e) => setCustomProvider(e.target.value)} placeholder="provider" style={{ flex: 1 }} />
          <input value={customModel} onChange={(e) => setCustomModel(e.target.value)} placeholder="model" style={{ flex: 1 }} />
          <button
            onClick={() => customProvider && customModel && onActivate(customProvider, customModel)}
            disabled={!customProvider || !customModel || isPending}
          >
            Активировать
          </button>
        </div>
      )}

      <p style={{ margin: "0 0 8px", fontSize: "0.82em", fontWeight: 600, color: "#374151" }}>Бесплатные</p>
      {freePresets.map(renderPreset)}

      <p style={{ margin: "16px 0 8px", fontSize: "0.82em", fontWeight: 600, color: "#374151" }}>Платные</p>
      {paidPresets.map(renderPreset)}
    </div>
  );
};

const AdminModelsPage = () => {
  const queryClient = useQueryClient();
  const models = useQuery({
    queryKey: ["admin-models"],
    queryFn: async () => (await api.get("/admin/models")).data,
  });

  const update = useMutation({
    mutationFn: async (payload: { purpose: "transcription" | "postprocessing"; provider: string; model: string }) =>
      (await api.put(`/admin/models/${payload.purpose}`, { provider: payload.provider, model: payload.model })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-models"] }),
  });

  const activeTranscription = models.data?.find((item: any) => item.purpose === "transcription" && item.isActive);
  const activePostprocessing = models.data?.find((item: any) => item.purpose === "postprocessing" && item.isActive);

  const handleActivate = (purpose: "transcription" | "postprocessing") =>
    (provider: string, model: string) => {
      update.mutate({ purpose, provider, model });
    };

  return (
    <AppShell>
      <section className="card">
        <h2>Настройки ИИ</h2>
        {models.isError && (
          <p className="error">
            {(models.error as any)?.response?.status === 403
              ? "Нет доступа. Войдите заново — для admin-раздела нужен токен с правами администратора."
              : "Не удалось загрузить настройки. Проверьте соединение."}
          </p>
        )}

        <h3 style={{ marginTop: 0 }}>Транскрипция (STT)</h3>
        {activeTranscription ? (
          <SttPresetSelector
            activeProvider={activeTranscription.provider}
            activeModel={activeTranscription.model}
            onActivate={handleActivate("transcription")}
            isPending={update.isPending}
          />
        ) : (
          models.isLoading ? <p>Загрузка...</p> : null
        )}

        <hr style={{ margin: "24px 0", border: "none", borderTop: "1px solid #e5e7eb" }} />

        <h3>Постобработка (LLM)</h3>
        <p className="muted" style={{ fontSize: "0.85em", marginTop: -8 }}>
          Используется одновременно для суммаризации, задач, спикеров и Q&A по встрече.
        </p>
        {activePostprocessing && (
          <ModelConfigRow
            title=""
            model={activePostprocessing}
            onSave={(provider, model) => {
              if (window.confirm("Активировать выбранную модель постобработки?")) {
                update.mutate({ purpose: "postprocessing", provider, model });
              }
            }}
          />
        )}

        {update.isError && <p className="error" style={{ marginTop: 12 }}>Не удалось обновить модель</p>}
        {update.isSuccess && <p style={{ color: "#16a34a", marginTop: 12 }}>✓ Модель обновлена</p>}
      </section>
    </AppShell>
  );
};

const ModelConfigRow = ({
  title,
  model,
  onSave,
}: {
  title: string;
  model: any;
  onSave: (provider: string, model: string) => void;
}) => {
  const [provider, setProvider] = useState(model.provider);
  const [value, setValue] = useState(model.model);
  return (
    <div style={{ marginTop: title ? 8 : 0 }}>
      {title && <p className="muted" style={{ marginBottom: 6 }}>Активная: <strong>{model.provider}/{model.model}</strong></p>}
      <div className="task-grid">
        <input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="provider (openai, ollama...)" />
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="model name" />
        <button onClick={() => onSave(provider, value)}>Активировать</button>
      </div>
    </div>
  );
};

const AdminUsersPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editName, setEditName] = useState("");
  const [editIsAdmin, setEditIsAdmin] = useState(false);
  const [editPassword, setEditPassword] = useState("");

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const users = useQuery({
    queryKey: ["admin-users", search],
    queryFn: async () =>
      (await api.get("/admin/users", { params: { search: search || undefined } })).data,
  });

  const createUser = useMutation({
    mutationFn: async () =>
      (await api.post("/admin/users", { email: newEmail, password: newPassword, name: newName || undefined, isAdmin: newIsAdmin })).data,
    onSuccess: () => {
      setNewEmail(""); setNewPassword(""); setNewName(""); setNewIsAdmin(false); setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const updateUser = useMutation({
    mutationFn: async (userId: string) => {
      const payload: Record<string, unknown> = { email: editEmail, name: editName || null, isAdmin: editIsAdmin };
      if (editPassword) payload.password = editPassword;
      return (await api.patch(`/admin/users/${userId}`, payload)).data;
    },
    onSuccess: () => {
      setEditingId(null); setEditPassword("");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => api.delete(`/admin/users/${userId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const startEdit = (user: any) => {
    setEditingId(user.id);
    setEditEmail(user.email);
    setEditName(user.name ?? "");
    setEditIsAdmin(user.isAdmin);
    setEditPassword("");
  };

  return (
    <AppShell>
      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Пользователи</h2>
          <button onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "Отмена" : "+ Добавить"}
          </button>
        </div>

        {showCreate && (
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginBottom: 16, background: "#f9fafb" }}>
            <p style={{ margin: "0 0 12px", fontWeight: 600 }}>Новый пользователь</p>
            <div className="task-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr auto auto" }}>
              <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Email" />
              <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Пароль (мин. 6)" type="password" />
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Имя (необязательно)" />
              <label style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                <input type="checkbox" checked={newIsAdmin} onChange={(e) => setNewIsAdmin(e.target.checked)} />
                Admin
              </label>
              <button
                onClick={() => createUser.mutate()}
                disabled={!newEmail || !newPassword || createUser.isPending}
              >
                Создать
              </button>
            </div>
            {createUser.isError && (
              <p className="error" style={{ marginTop: 8 }}>
                {(createUser.error as any)?.response?.data?.error ?? "Ошибка создания"}
              </p>
            )}
          </div>
        )}

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по email или имени…"
          style={{ width: "100%", marginBottom: 12, boxSizing: "border-box" }}
        />

        {users.isLoading && <p>Загрузка...</p>}
        {users.isError && <p className="error">Не удалось загрузить пользователей</p>}

        {users.data?.map((user: any) => (
          <div key={user.id} style={{ borderBottom: "1px solid #f3f4f6", padding: "12px 0" }}>
            {editingId === user.id ? (
              <div>
                <div className="task-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr auto auto auto" }}>
                  <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="Email" />
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Имя" />
                  <input value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="Новый пароль (необязательно)" type="password" />
                  <label style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                    <input type="checkbox" checked={editIsAdmin} onChange={(e) => setEditIsAdmin(e.target.checked)} />
                    Admin
                  </label>
                  <button onClick={() => updateUser.mutate(user.id)} disabled={updateUser.isPending}>Сохранить</button>
                  <button onClick={() => setEditingId(null)}>Отмена</button>
                </div>
                {updateUser.isError && (
                  <p className="error" style={{ marginTop: 6 }}>
                    {(updateUser.error as any)?.response?.data?.error ?? "Ошибка сохранения"}
                  </p>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>{user.email}</strong>
                  {user.name && <span className="muted"> · {user.name}</span>}
                  {user.isAdmin && (
                    <span style={{ marginLeft: 8, fontSize: "0.75em", padding: "2px 8px", borderRadius: 99, background: "#fef3c7", color: "#92400e", fontWeight: 700 }}>
                      ADMIN
                    </span>
                  )}
                  <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.8em" }}>
                    Создан: {new Date(user.createdAt).toLocaleDateString("ru")}
                    {" · "}встречи: {user._count.createdMeetings}
                    {" · "}spaces: {user._count.memberships}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => startEdit(user)} style={{ fontSize: "0.85em" }}>Редактировать</button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Удалить пользователя ${user.email}? Это действие нельзя отменить.`)) {
                        deleteUser.mutate(user.id);
                      }
                    }}
                    style={{ fontSize: "0.85em", color: "#dc2626", borderColor: "#fca5a5" }}
                    disabled={deleteUser.isPending}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </section>
    </AppShell>
  );
};

const Guard = ({ children }: { children: ReactNode }) => {
  if (!hasToken()) {
    return <Navigate to="/login" replace />;
  }
  return (
    <div>
      <div className="top-bar">
        <button
          onClick={() => {
            clearToken();
            window.location.href = "/login";
          }}
        >
          Logout
        </button>
      </div>
      {children}
    </div>
  );
};

export const App = () => (
  <Routes>
    <Route path="/login" element={<AuthPage mode="login" />} />
    <Route path="/register" element={<AuthPage mode="register" />} />
    <Route
      path="/meetings"
      element={
        <Guard>
          <MeetingsPage />
        </Guard>
      }
    />
    <Route
      path="/meetings/:meetingId"
      element={
        <Guard>
          <MeetingDetailsPage />
        </Guard>
      }
    />
    <Route
      path="/admin/runs"
      element={
        <Guard>
          <AdminRunsPage />
        </Guard>
      }
    />
    <Route
      path="/admin/runs/:runId"
      element={
        <Guard>
          <AdminRunDetailsPage />
        </Guard>
      }
    />
    <Route
      path="/admin/models"
      element={
        <Guard>
          <AdminModelsPage />
        </Guard>
      }
    />
    <Route
      path="/admin/users"
      element={
        <Guard>
          <AdminUsersPage />
        </Guard>
      }
    />
    <Route path="*" element={<Navigate to={hasToken() ? "/meetings" : "/login"} replace />} />
  </Routes>
);
