import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownAZ,
  ArrowDownZA,
  BookOpen,
  CheckSquare,
  Download,
  FileAudio,
  FileText,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Share2,
  Sparkles,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { api, clearToken, getTokenPayload, hasToken, saveToken } from "./api";

// ── Sidebar NavLink ────────────────────────────────────────────────────────

const SidebarLink = ({
  to,
  icon,
  label,
}: {
  to: string;
  icon: ReactNode;
  label: string;
}) => {
  const location = useLocation();
  const active = location.pathname.startsWith(to);
  return (
    <Link to={to} className={`sidebar-link${active ? " active" : ""}`}>
      {icon}
      {label}
    </Link>
  );
};

// ── AppShell ───────────────────────────────────────────────────────────────

const AppShell = ({ children }: { children: ReactNode }) => {
  const isAdmin = getTokenPayload().isAdmin ?? false;
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <BookOpen size={20} color="var(--accent)" />
          Meeting AI
        </div>
        <nav className="sidebar-nav">
          <SidebarLink to="/meetings" icon={<LayoutDashboard size={16} />} label="Встречи" />
          {isAdmin && (
            <SidebarLink to="/admin/runs" icon={<FileText size={16} />} label="Журнал обработок" />
          )}
          {isAdmin && (
            <SidebarLink to="/admin/models" icon={<Settings size={16} />} label="Настройки ИИ" />
          )}
          {isAdmin && (
            <SidebarLink to="/admin/users" icon={<Users size={16} />} label="Пользователи" />
          )}
        </nav>
        <div className="sidebar-footer">
          <button
            className="sidebar-link"
            onClick={() => {
              clearToken();
              window.location.href = "/login";
            }}
          >
            <LogOut size={16} />
            Выйти
          </button>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
};

// ── StatusBadge ────────────────────────────────────────────────────────────

const STATUS_CLASS: Record<string, string> = {
  READY:      "badge-ready",
  PROCESSING: "badge-processing",
  FAILED:     "badge-failed",
  CREATED:    "badge-created",
};

const STATUS_LABEL: Record<string, string> = {
  READY:      "Готово",
  PROCESSING: "Обработка…",
  FAILED:     "Ошибка",
  CREATED:    "Создана",
};

const StatusBadge = ({ status }: { status: string }) => (
  <span className={`badge ${STATUS_CLASS[status] ?? "badge-created"}`}>
    {STATUS_LABEL[status] ?? status}
  </span>
);

// ── Auth ───────────────────────────────────────────────────────────────────

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
      <form className="card auth-card" onSubmit={onSubmit}>
        <div style={{ textAlign: "center", marginBottom: 4 }}>
          <BookOpen size={32} color="var(--accent)" />
          <h2 style={{ margin: "10px 0 0", fontSize: "1.3em" }}>
            {mode === "login" ? "Добро пожаловать" : "Создать аккаунт"}
          </h2>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "0.85em" }}>
            {mode === "login" ? "Войдите в свой аккаунт" : "Зарегистрируйтесь бесплатно"}
          </p>
        </div>

        {mode === "register" && (
          <input
            placeholder="Имя (необязательно)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
        <input
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
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
        <button className="btn btn-primary" type="submit" disabled={mutation.isPending} style={{ width: "100%", justifyContent: "center", padding: "10px" }}>
          {mutation.isPending ? "Загрузка..." : mode === "login" ? "Войти" : "Создать аккаунт"}
        </button>

        {mutation.isError && (
          <p className="error" style={{ textAlign: "center" }}>{resolveAuthError(mutation.error)}</p>
        )}

        <p style={{ textAlign: "center", margin: 0, fontSize: "0.85em", color: "var(--muted)" }}>
          {mode === "login" ? (
            <>Нет аккаунта? <Link to="/register">Зарегистрируйтесь</Link></>
          ) : (
            <>Уже есть аккаунт? <Link to="/login">Войти</Link></>
          )}
        </p>
      </form>
    </div>
  );
};

// ── MeetingMenu ────────────────────────────────────────────────────────────

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

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        className="btn btn-ghost btn-sm"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        title="Действия"
        style={{ padding: "4px 8px" }}
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div className="dropdown-menu">
          <button
            className="dropdown-item"
            onClick={(e) => { e.stopPropagation(); setOpen(false); navigate(`/meetings/${meetingId}`); }}
          >
            Открыть
          </button>
          <button
            className="dropdown-item"
            onClick={(e) => { e.stopPropagation(); setOpen(false); alert("Переместить — в разработке"); }}
          >
            Переместить
          </button>
          <button
            className="dropdown-item danger"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              if (window.confirm("Удалить встречу? Это действие нельзя отменить.")) {
                deleteMeeting.mutate();
              }
            }}
          >
            <Trash2 size={14} /> Удалить
          </button>
        </div>
      )}
    </div>
  );
};

// ── MeetingsPage ───────────────────────────────────────────────────────────

const EXAMPLES = [
  "20_03_2026 Встреча при Ген.директоре",
  "10_02_2025 Подготовка к 23 февраля",
  "30_03_2026 Финансовые результаты квартала",
  "11_04_2026 Стендап команды разработки",
];

const MeetingsPage = () => {
  const [title, setTitle] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  };

  const meetings = useQuery({
    queryKey: ["meetings", debouncedSearch, statusFilter, order],
    queryFn: async () =>
      (await api.get("/me/meetings", {
        params: {
          search: debouncedSearch || undefined,
          status: statusFilter || undefined,
          sortBy: "title",
          order,
        },
      })).data,
  });

  const createMeeting = useMutation({
    mutationFn: async () => (await api.post("/me/meetings", { title })).data,
    onSuccess: (data) => {
      setTitle("");
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      navigate(`/meetings/${data.id}`);
    },
  });

  const toggleOrder = () => setOrder((o) => (o === "asc" ? "desc" : "asc"));

  return (
    <AppShell>
      <section className="card">
        <h2 style={{ margin: "0 0 14px", fontSize: "1.1em", fontWeight: 600 }}>Новая встреча</h2>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) createMeeting.mutate();
          }}
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Укажите дату и название встречи"
            style={{ flex: 1, minWidth: 260 }}
          />
          <button className="btn btn-primary" type="submit" disabled={createMeeting.isPending || !title.trim()}>
            <Plus size={16} />
            {createMeeting.isPending ? "Создание..." : "Создать"}
          </button>
        </form>
        <div style={{ marginTop: 10 }}>
          <p style={{ margin: "0 0 4px", fontSize: "0.76em", color: "var(--muted)", fontWeight: 500 }}>Примеры:</p>
          {EXAMPLES.map((ex) => (
            <p key={ex} style={{ margin: "0", fontSize: "0.76em", color: "var(--muted)" }}>
              {ex}
            </p>
          ))}
        </div>
      </section>

      <section className="card">
        {/* Поиск и фильтры */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
            <input
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Поиск по названию..."
              style={{ width: "100%", paddingLeft: 32 }}
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ minWidth: 140 }}>
            <option value="">Все статусы</option>
            <option value="CREATED">Создана</option>
            <option value="PROCESSING">Обработка</option>
            <option value="READY">Готово</option>
            <option value="FAILED">Ошибка</option>
          </select>
          <button
            className="btn btn-secondary btn-sm"
            onClick={toggleOrder}
            title={order === "asc" ? "А → Я (нажмите для Я → А)" : "Я → А (нажмите для А → Я)"}
          >
            {order === "asc" ? <ArrowDownAZ size={15} /> : <ArrowDownZA size={15} />}
            {order === "asc" ? "А–Я" : "Я–А"}
          </button>
        </div>

        {meetings.isLoading && <p className="muted">Загрузка...</p>}
        {meetings.isError && <p className="error">Не удалось загрузить встречи</p>}
        {!meetings.isLoading && meetings.data?.length === 0 && (
          <p className="muted" style={{ margin: 0 }}>
            {debouncedSearch || statusFilter ? "Ничего не найдено. Попробуйте изменить фильтры." : "Нет встреч. Создайте первую выше."}
          </p>
        )}
        <div className="meeting-list">
          {meetings.data?.map((meeting: any) => (
            <div
              key={meeting.id}
              className="meeting-card"
              onClick={() => navigate(`/meetings/${meeting.id}`)}
            >
              <FileAudio size={18} color="var(--accent)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {meeting.title}
                </p>
                <p style={{ margin: 0, fontSize: "0.78em", color: "var(--muted)" }}>
                  задачи: {meeting._count.tasks} · спикеры: {meeting._count.speakers}
                </p>
              </div>
              <StatusBadge status={meeting.status} />
              <MeetingMenu
                meetingId={meeting.id}
                onDeleted={() => queryClient.invalidateQueries({ queryKey: ["meetings"] })}
              />
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
};

// ── parseSummary ───────────────────────────────────────────────────────────

function parseSummary(text: string): { topics: string[]; decisions: string[] } | null {
  try {
    const parsed = JSON.parse(text);
    if (parsed && Array.isArray(parsed.topics)) return parsed as { topics: string[]; decisions: string[] };
  } catch { /* plain text fallback */ }
  return null;
}

// ── SummarySection ─────────────────────────────────────────────────────────

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
    <div>
      <div className="section-header">
        <h3>Саммари</h3>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
        >
          <Sparkles size={14} />
          {generate.isPending ? "Генерация..." : summary ? "Обновить" : "Получить саммари"}
        </button>
      </div>

      {generate.isError && <p className="error" style={{ marginBottom: 8 }}>Не удалось получить саммари</p>}
      {!summary && <p className="muted">Саммари ещё не сформировано. Нажмите «Получить саммари».</p>}

      {summary && structured && (
        <div style={{ display: "grid", gap: 16 }}>
          <div>
            <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: "0.88em", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Темы обсуждения</p>
            <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 4 }}>
              {structured.topics.map((topic, i) => (
                <li key={i} style={{ lineHeight: 1.5 }}>{topic}</li>
              ))}
            </ul>
          </div>
          {structured.decisions.length > 0 && (
            <div>
              <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: "0.88em", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Принятые решения</p>
              <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 4 }}>
                {structured.decisions.map((decision, i) => (
                  <li key={i} style={{ lineHeight: 1.5 }}>{decision}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {summary && !structured && (
        <p style={{ margin: 0, lineHeight: 1.7 }}>{summary.text}</p>
      )}
    </div>
  );
};

// ── HighlightedText ────────────────────────────────────────────────────────

const HighlightedText = ({ text, query }: { text: string; query: string }) => {
  if (!query) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} style={{ background: "#fef08a", borderRadius: 2, padding: "0 1px" }}>{part}</mark>
        ) : (
          part
        ),
      )}
    </>
  );
};

// ── TranscriptSection ──────────────────────────────────────────────────────

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
  const [transcriptSearch, setTranscriptSearch] = useState("");
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
    <div>
      <div className="section-header">
        <h3>Транскрипция</h3>
        {!editing ? (
          <button className="btn btn-secondary btn-sm" onClick={startEdit}>
            Редактировать
          </button>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => save.mutate()}
              disabled={save.isPending}
            >
              {save.isPending ? "Сохранение..." : "Сохранить"}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={cancelEdit}>
              Отмена
            </button>
          </div>
        )}
      </div>

      {save.isError && <p className="error" style={{ marginBottom: 8 }}>Не удалось сохранить транскрипцию</p>}

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
                    style={{ fontSize: "0.78em", padding: "3px 6px", maxWidth: 130 }}
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
                  style={{ flex: 1, resize: "vertical", fontSize: "0.9em", lineHeight: 1.5 }}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div>
          {transcriptLines.length === 0 ? (
            <p className="muted">Транскрипция отсутствует. Загрузите аудио/видео файл.</p>
          ) : (
            <>
              <div style={{ position: "relative", marginBottom: 12 }}>
                <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
                <input
                  value={transcriptSearch}
                  onChange={(e) => setTranscriptSearch(e.target.value)}
                  placeholder="Поиск в транскрипции..."
                  style={{ width: "100%", paddingLeft: 32, fontSize: "0.88em" }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {meetingData?.transcript?.segments
                  ?.filter((seg: any) =>
                    !transcriptSearch ||
                    seg.text.toLowerCase().includes(transcriptSearch.toLowerCase()),
                  )
                  .map((seg: any) => {
                    const time = new Date(seg.startSec * 1000).toISOString().substring(11, 19);
                    return (
                      <div key={seg.id} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                        <span style={{ fontSize: "0.75em", color: "var(--muted)", whiteSpace: "nowrap", flexShrink: 0, paddingTop: 2 }}>
                          [{time}]
                        </span>
                        <span style={{ fontSize: "0.9em", lineHeight: 1.6 }}>
                          <strong style={{ fontWeight: 600 }}>
                            {seg.speaker?.confirmedName ?? seg.speaker?.suggestedName ?? seg.speaker?.autoLabel ?? "Speaker"}
                          </strong>
                          {": "}
                          <HighlightedText text={seg.text} query={transcriptSearch} />
                        </span>
                      </div>
                    );
                  })}
                {transcriptSearch &&
                  meetingData?.transcript?.segments?.filter((seg: any) =>
                    seg.text.toLowerCase().includes(transcriptSearch.toLowerCase()),
                  ).length === 0 && (
                  <p className="muted" style={{ margin: 0 }}>Ничего не найдено</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ── TranscribingAnimation ──────────────────────────────────────────────────

const TranscribingAnimation = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <div className="spinner" />
    <span style={{ color: "var(--muted)", fontSize: "0.9em" }}>Идёт транскрибация…</span>
  </div>
);

// ── TelegramRecipientPicker ────────────────────────────────────────────────

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
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <p style={{ margin: 0, fontSize: "0.85em", color: "var(--muted)" }}>Выберите получателей:</p>
        <button
          className="btn btn-outline btn-sm"
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
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
          style={{ width: "100%", marginBottom: 8 }}
        />
      )}

      {filtered.map((contact) => (
        <label
          key={contact.chatId}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--line)", cursor: "pointer" }}
        >
          <input
            type="checkbox"
            checked={selected.has(contact.chatId)}
            onChange={() => toggle(contact.chatId)}
            style={{ width: 16, height: 16, padding: 0, flexShrink: 0 }}
          />
          <span style={{ fontSize: "0.9em" }}>
            <strong>{contact.name}</strong>
            {contact.username && (
              <span style={{ marginLeft: 6, color: "var(--muted)", fontSize: "0.85em" }}>@{contact.username}</span>
            )}
            {contact.type !== "private" && (
              <span style={{ marginLeft: 6, fontSize: "0.78em", color: "var(--muted)" }}>({contact.type})</span>
            )}
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

// ── SpeakerRow ─────────────────────────────────────────────────────────────

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
        {speaker.suggestedName && (
          <p style={{ margin: "2px 0 0", fontSize: "0.82em", color: "var(--muted)" }}>
            предложено: {speaker.suggestedName}
          </p>
        )}
      </div>
      <div className="inline-form">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Подтверждённое имя" style={{ width: 180 }} />
        <button className="btn btn-secondary btn-sm" onClick={() => update.mutate()}>
          Сохранить
        </button>
      </div>
    </div>
  );
};

// ── SpeakersSection ────────────────────────────────────────────────────────

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
    <div>
      <div className="section-header">
        <h3>Спикеры</h3>
      </div>

      {speakers.length === 0 && (
        <p className="muted" style={{ marginBottom: 12 }}>Спикеры появятся после транскрибации с диаризацией.</p>
      )}

      {speakers.map((speaker: any) => (
        <SpeakerRow key={speaker.id} meetingId={meetingId} speaker={speaker} />
      ))}

      <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
        <p style={{ margin: "0 0 8px", fontSize: "0.85em", color: "var(--muted)" }}>Добавить спикера вручную:</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Метка (напр. SPEAKER_3)"
            style={{ flex: 1, minWidth: 160 }}
          />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Имя (необязательно)"
            style={{ flex: 1, minWidth: 160 }}
          />
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => addSpeaker.mutate()}
            disabled={!newLabel || addSpeaker.isPending}
          >
            Добавить
          </button>
        </div>
        {addSpeaker.isError && <p className="error" style={{ marginTop: 6 }}>Не удалось добавить спикера</p>}
      </div>
    </div>
  );
};

// ── TaskRow ────────────────────────────────────────────────────────────────

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
      <input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Ответственный" />
      <input value={dueDate} onChange={(e) => setDueDate(e.target.value)} placeholder="Срок" />
      <button className="btn btn-secondary btn-sm" onClick={() => update.mutate()} disabled={update.isPending}>
        {update.isPending ? "..." : "Сохранить"}
      </button>
      <div ref={menuRef} style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setMenuOpen((v) => !v)}
          style={{ padding: "4px 8px" }}
        >
          <MoreHorizontal size={15} />
        </button>
        {menuOpen && (
          <div className="dropdown-menu">
            <button
              className="dropdown-item danger"
              onClick={() => {
                setMenuOpen(false);
                if (window.confirm("Удалить задачу?")) remove.mutate();
              }}
            >
              <Trash2 size={14} /> Удалить
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ── TasksSection ───────────────────────────────────────────────────────────

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
    <div>
      <div className="section-header">
        <h3>Задачи</h3>
      </div>

      {tasks.length > 0 && (
        <div className="task-grid" style={{ color: "var(--muted)", fontSize: "0.76em", fontWeight: 600, paddingBottom: 4, borderBottom: "1px solid var(--line)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          <span>Задача</span>
          <span>Ответственный</span>
          <span>Срок</span>
          <span />
          <span />
        </div>
      )}
      {tasks.length === 0 && (
        <p className="muted" style={{ marginBottom: 12 }}>Задачи будут извлечены при нажатии «Получить саммари»</p>
      )}
      {tasks.map((task: any) => (
        <TaskRow key={task.id} meetingId={meetingId} task={task} />
      ))}

      <div className="task-grid" style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
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
          className="btn btn-secondary btn-sm"
          onClick={() => createTask.mutate()}
          disabled={!newText || createTask.isPending}
        >
          <Plus size={14} />
          {createTask.isPending ? "..." : "Добавить"}
        </button>
        <span />
      </div>
      {createTask.isError && <p className="error" style={{ marginTop: 6 }}>Не удалось создать задачу</p>}
    </div>
  );
};

// ── MeetingDetailsPage ─────────────────────────────────────────────────────

type TabKey = "transcript" | "speakers" | "summary" | "tasks" | "chat" | "export";

const TABS: { key: TabKey; label: string; icon: ReactNode }[] = [
  { key: "transcript", label: "Транскрипция", icon: <FileText size={14} /> },
  { key: "speakers",   label: "Спикеры",      icon: <Users size={14} /> },
  { key: "summary",    label: "Саммари",       icon: <Sparkles size={14} /> },
  { key: "tasks",      label: "Задачи",        icon: <CheckSquare size={14} /> },
  { key: "chat",       label: "Чат",           icon: <MessageCircle size={14} /> },
  { key: "export",     label: "Экспорт",       icon: <Share2 size={14} /> },
];

const MeetingDetailsPage = () => {
  const { meetingId = "" } = useParams();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>("transcript");
  const [question, setQuestion] = useState("");
  const [target, setTarget] = useState<"EMAIL" | "TELEGRAM">("EMAIL");
  const [destination, setDestination] = useState("");
  const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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
      (await api.post(`/me/meetings/${meetingId}/export`,
        target === "TELEGRAM"
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
      {!meetingData && meeting.isLoading && <p className="muted">Загрузка...</p>}
      {meeting.isError && <p className="error">Не удалось загрузить детали встречи</p>}
      {meetingData && (
        <>
          {/* Шапка */}
          <section className="card">
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <h2 style={{ margin: 0, fontSize: "1.25em", fontWeight: 700 }}>{meetingData.title}</h2>
                  <StatusBadge status={meetingData.status} />
                </div>
                {meetingData.processingError && (
                  <p className="error" style={{ marginTop: 4, fontSize: "0.85em" }}>{meetingData.processingError}</p>
                )}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={downloadTranscript} title="Скачать транскрипцию">
                <Download size={15} /> Скачать .txt
              </button>
            </div>

            <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <label style={{ cursor: "pointer" }}>
                <span className="btn btn-secondary btn-sm">
                  <Upload size={14} /> Загрузить аудио/видео
                </span>
                <input
                  type="file"
                  style={{ display: "none" }}
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {selectedFile && (
                <span style={{ fontSize: "0.82em", color: "var(--muted)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {selectedFile.name}
                </span>
              )}
              <button
                className="btn btn-primary btn-sm"
                onClick={() => selectedFile && uploadMutation.mutate(selectedFile)}
                disabled={!selectedFile || uploadMutation.isPending}
              >
                {uploadMutation.isPending ? "Загрузка..." : "Транскрибировать"}
              </button>
              {isProcessing && <TranscribingAnimation />}
            </div>
            {uploadMutation.isError && <p className="error" style={{ marginTop: 8 }}>Ошибка загрузки файла</p>}
          </section>

          {/* Вкладки */}
          <section className="card" style={{ padding: "0" }}>
            <div className="tabs" style={{ padding: "0 20px" }}>
              {TABS.map((t) => (
                <button
                  key={t.key}
                  className={`tab-btn${tab === t.key ? " active" : ""}`}
                  onClick={() => setTab(t.key)}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            <div className="tab-panel" style={{ padding: "20px 24px" }}>
              {tab === "transcript" && (
                <TranscriptSection
                  meetingId={meetingId}
                  meetingData={meetingData}
                  transcriptLines={transcriptLines}
                />
              )}

              {tab === "speakers" && (
                <SpeakersSection meetingId={meetingId} speakers={meetingData.speakers} />
              )}

              {tab === "summary" && (
                <SummarySection meetingId={meetingId} summary={meetingData.summary} />
              )}

              {tab === "tasks" && (
                <TasksSection meetingId={meetingId} tasks={meetingData.tasks} />
              )}

              {tab === "chat" && (
                <div>
                  <div className="section-header">
                    <h3>Чат по встрече</h3>
                  </div>
                  {meetingData.questions.length === 0 && (
                    <p className="muted" style={{ marginBottom: 14 }}>
                      Задайте вопрос — AI ответит на основе транскрипции.
                    </p>
                  )}
                  {meetingData.questions.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                      {meetingData.questions.map((item: any) => (
                        <div key={item.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            <div className="chat-bubble-user">{item.question}</div>
                          </div>
                          <div style={{ display: "flex", justifyContent: "flex-start" }}>
                            <div className="chat-bubble-ai">{item.answer}</div>
                          </div>
                        </div>
                      ))}
                    </div>
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
                    <button className="btn btn-primary" type="submit" disabled={ask.isPending || !question.trim()}>
                      {ask.isPending ? "..." : "Спросить"}
                    </button>
                  </form>
                  {ask.isError && <p className="error" style={{ marginTop: 6 }}>Не удалось получить ответ</p>}
                </div>
              )}

              {tab === "export" && (
                <div>
                  <div className="section-header">
                    <h3>Экспорт</h3>
                  </div>
                  <div className="inline-form" style={{ marginBottom: 8 }}>
                    <select
                      value={target}
                      onChange={(e) => {
                        setTarget(e.target.value as "EMAIL" | "TELEGRAM");
                        setSelectedChats(new Set());
                      }}
                    >
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
                      className="btn btn-primary"
                      onClick={() => exportMutation.mutate()}
                      disabled={
                        exportMutation.isPending ||
                        (target === "TELEGRAM" && selectedChats.size === 0) ||
                        (target === "EMAIL" && !destination)
                      }
                    >
                      <Share2 size={15} />
                      {exportMutation.isPending
                        ? "Отправка..."
                        : `Отправить${target === "TELEGRAM" && selectedChats.size > 0 ? ` (${selectedChats.size})` : ""}`}
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
                  {exportMutation.isSuccess && (
                    <p style={{ color: "var(--success)", marginTop: 6 }}>✓ Экспорт выполнен</p>
                  )}
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
};

// ── Admin pages ────────────────────────────────────────────────────────────

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
        <h2 style={{ margin: "0 0 14px" }}>Фильтры</h2>
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
          <label className="inline-form">
            <span style={{ fontSize: "0.85em", color: "var(--muted)" }}>От</span>
            <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="inline-form">
            <span style={{ fontSize: "0.85em", color: "var(--muted)" }}>До</span>
            <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <select value={hasErrors} onChange={(e) => setHasErrors(e.target.value)}>
            <option value="">Ошибки: любые</option>
            <option value="true">Только с ошибками</option>
            <option value="false">Только без ошибок</option>
          </select>
        </div>
      </section>

      <section className="card">
        <h2 style={{ margin: "0 0 14px" }}>Журнал обработок</h2>
        {runs.isLoading && <p className="muted">Загрузка...</p>}
        {runs.isError && <p className="error">Не удалось загрузить журнал</p>}
        {runs.data?.map((run: any) => (
          <div className="list-row" key={run.id}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <strong>{run.meeting.title}</strong>
                <span className="badge badge-created">{run.status}</span>
              </div>
              <p style={{ margin: "2px 0 0", fontSize: "0.82em", color: "var(--muted)" }}>
                {run.user.email} · {run.provider ?? "-"}/{run.model ?? "-"} · cost: {run.totalCost}
              </p>
              <p style={{ margin: "1px 0 0", fontSize: "0.78em", color: "var(--muted)" }}>
                {new Date(run.createdAt).toLocaleString("ru")} · шагов: {run._count.steps}
                {run.errorMessage ? ` · ошибка: ${run.errorMessage}` : ""}
              </p>
            </div>
            <Link to={`/admin/runs/${run.id}`} className="btn btn-secondary btn-sm">Детали</Link>
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
        <div className="section-header">
          <h2 style={{ margin: 0 }}>Детали запуска</h2>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => rerun.mutate()}
            disabled={rerun.isPending}
          >
            {rerun.isPending ? "Запуск..." : "Перезапустить"}
          </button>
        </div>
        {details.data && (
          <div className="details-grid">
            <p><strong>Встреча:</strong> {details.data.meeting.title}</p>
            <p><strong>Пользователь:</strong> {details.data.user.email}</p>
            <p><strong>Статус:</strong> {details.data.status}</p>
            <p><strong>Стоимость:</strong> {details.data.totalCost}</p>
            <p><strong>Длительность:</strong> {details.data.durationMs ?? 0}ms</p>
            <p><strong>Транскрипция:</strong> {details.data.transcriptionProvider ?? "-"}/{details.data.transcriptionModel ?? "-"}</p>
            <p><strong>Постобработка:</strong> {details.data.postprocessingProvider ?? "-"}/{details.data.postprocessingModel ?? "-"}</p>
            {details.data.errorMessage && <p className="error">Ошибка: {details.data.errorMessage}</p>}
          </div>
        )}
        {details.isError && <p className="error">Не удалось загрузить детали</p>}
        {details.data?.steps?.map((step: any) => (
          <div className="list-row" key={step.id}>
            <div>
              <strong>{step.stepName}</strong>
              <p style={{ margin: "2px 0 0", fontSize: "0.82em", color: "var(--muted)" }}>
                {step.status} · {step.provider}/{step.model} · {step.durationMs}ms · cost: {step.cost}
              </p>
              {step.errorMessage && <p className="error" style={{ fontSize: "0.85em", marginTop: 2 }}>{step.errorMessage}</p>}
            </div>
          </div>
        ))}
      </section>
    </AppShell>
  );
};

// ── Admin Models ───────────────────────────────────────────────────────────

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
      <div key={preset.provider + preset.model} className={`model-card${isActive ? " active" : ""}`}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
            <strong style={{ fontSize: "0.95em" }}>{preset.name}</strong>
            <span className={`badge badge-${preset.tier}`}>{preset.price}</span>
            {preset.diarization && <span className="badge badge-diarize">диаризация</span>}
            {isActive && <span className="badge badge-active">АКТИВНА</span>}
          </div>
          <p style={{ margin: 0, fontSize: "0.82em", color: "var(--muted)" }}>{preset.description}</p>
          <p style={{ margin: "4px 0 0", fontSize: "0.78em", color: "#9ca3af" }}>
            Требует: <code style={{ background: "var(--surface-2)", padding: "1px 5px", borderRadius: 4 }}>{preset.envVar}</code>
            {preset.setupNote && (
              <span> · <code style={{ background: "var(--surface-2)", padding: "1px 5px", borderRadius: 4 }}>{preset.setupNote}</code></span>
            )}
          </p>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => onActivate(preset.provider, preset.model)}
          disabled={isActive || isPending}
        >
          {isActive ? "Активна" : "Активировать"}
        </button>
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: "0.9em" }}>
          <strong>Активная: </strong>
          <code style={{ background: "var(--surface-2)", padding: "2px 8px", borderRadius: 4 }}>
            {activeProvider}/{activeModel}
          </code>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setShowCustom((v) => !v)}
        >
          {showCustom ? "Скрыть" : "Ввести вручную"}
        </button>
      </div>

      {showCustom && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
          <input value={customProvider} onChange={(e) => setCustomProvider(e.target.value)} placeholder="provider" style={{ flex: 1 }} />
          <input value={customModel} onChange={(e) => setCustomModel(e.target.value)} placeholder="model" style={{ flex: 1 }} />
          <button
            className="btn btn-primary btn-sm"
            onClick={() => customProvider && customModel && onActivate(customProvider, customModel)}
            disabled={!customProvider || !customModel || isPending}
          >
            Активировать
          </button>
        </div>
      )}

      <p style={{ margin: "0 0 8px", fontSize: "0.8em", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Бесплатные</p>
      {freePresets.map(renderPreset)}

      <p style={{ margin: "16px 0 8px", fontSize: "0.8em", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Платные</p>
      {paidPresets.map(renderPreset)}
    </div>
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
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="provider (openai, ollama...)" style={{ flex: 1, minWidth: 160 }} />
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="model name" style={{ flex: 1, minWidth: 160 }} />
        <button className="btn btn-primary btn-sm" onClick={() => onSave(provider, value)}>Активировать</button>
      </div>
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
        <h2 style={{ margin: "0 0 20px" }}>Настройки ИИ</h2>

        {models.isError && (
          <p className="error">
            {(models.error as any)?.response?.status === 403
              ? "Нет доступа. Войдите заново — для admin-раздела нужен токен с правами администратора."
              : "Не удалось загрузить настройки. Проверьте соединение."}
          </p>
        )}

        <h3 style={{ margin: "0 0 12px" }}>Транскрипция (STT)</h3>
        {activeTranscription ? (
          <SttPresetSelector
            activeProvider={activeTranscription.provider}
            activeModel={activeTranscription.model}
            onActivate={handleActivate("transcription")}
            isPending={update.isPending}
          />
        ) : (
          models.isLoading ? <p className="muted">Загрузка...</p> : null
        )}

        <hr style={{ margin: "24px 0", border: "none", borderTop: "1px solid var(--line)" }} />

        <h3 style={{ margin: "0 0 4px" }}>Постобработка (LLM)</h3>
        <p className="muted" style={{ fontSize: "0.85em", margin: "0 0 12px" }}>
          Используется для суммаризации, задач, спикеров и Q&A по встрече.
        </p>
        {activePostprocessing && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              {[
                { provider: "openai", model: "gpt-4o-mini", label: "OpenAI GPT-4o-mini", price: "$0.15/1M" },
                { provider: "gemini", model: "gemini-2.0-flash", label: "Gemini 2.0 Flash", price: "~$0.10/1M" },
                { provider: "mock", model: "-", label: "Mock (разработка)", price: "бесплатно" },
              ].map((preset) => {
                const isActive = activePostprocessing.provider === preset.provider;
                return (
                  <div key={preset.provider} className={`model-card${isActive ? " active" : ""}`} style={{ flex: "1 1 200px" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 2 }}>
                        <strong style={{ fontSize: "0.9em" }}>{preset.label}</strong>
                        <span className="badge badge-free">{preset.price}</span>
                        {isActive && <span className="badge badge-active">АКТИВНА</span>}
                      </div>
                    </div>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={isActive || update.isPending}
                      onClick={() => update.mutate({ purpose: "postprocessing", provider: preset.provider, model: preset.model })}
                    >
                      {isActive ? "Активна" : "Активировать"}
                    </button>
                  </div>
                );
              })}
            </div>
            <ModelConfigRow
              title="Или задать вручную:"
              model={activePostprocessing}
              onSave={(provider, model) => {
                if (window.confirm("Активировать выбранную модель постобработки?")) {
                  update.mutate({ purpose: "postprocessing", provider, model });
                }
              }}
            />
          </>
        )}

        {update.isError && <p className="error" style={{ marginTop: 12 }}>Не удалось обновить модель</p>}
        {update.isSuccess && <p style={{ color: "var(--success)", marginTop: 12 }}>✓ Модель обновлена</p>}
      </section>
    </AppShell>
  );
};

// ── Admin Users ────────────────────────────────────────────────────────────

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
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "Отмена" : <><Plus size={14} /> Добавить</>}
          </button>
        </div>

        {showCreate && (
          <div style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", padding: 16, marginBottom: 16, background: "var(--surface-2)" }}>
            <p style={{ margin: "0 0 12px", fontWeight: 600 }}>Новый пользователь</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto auto", gap: 8 }}>
              <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Email" />
              <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Пароль (мин. 6)" type="password" />
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Имя (необязательно)" />
              <label style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", fontSize: "0.9em" }}>
                <input type="checkbox" checked={newIsAdmin} onChange={(e) => setNewIsAdmin(e.target.checked)} />
                Admin
              </label>
              <button
                className="btn btn-primary btn-sm"
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
          style={{ width: "100%", marginBottom: 12 }}
        />

        {users.isLoading && <p className="muted">Загрузка...</p>}
        {users.isError && <p className="error">Не удалось загрузить пользователей</p>}

        {users.data?.map((user: any) => (
          <div key={user.id} style={{ borderBottom: "1px solid var(--line)", padding: "12px 0" }}>
            {editingId === user.id ? (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto auto auto", gap: 8 }}>
                  <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="Email" />
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Имя" />
                  <input value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="Новый пароль (необязательно)" type="password" />
                  <label style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", fontSize: "0.9em" }}>
                    <input type="checkbox" checked={editIsAdmin} onChange={(e) => setEditIsAdmin(e.target.checked)} />
                    Admin
                  </label>
                  <button className="btn btn-primary btn-sm" onClick={() => updateUser.mutate(user.id)} disabled={updateUser.isPending}>Сохранить</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)}>Отмена</button>
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
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <strong>{user.email}</strong>
                    {user.name && <span className="muted" style={{ fontSize: "0.9em" }}>{user.name}</span>}
                    {user.isAdmin && <span className="badge badge-admin">ADMIN</span>}
                  </div>
                  <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.8em" }}>
                    Создан: {new Date(user.createdAt).toLocaleDateString("ru")}
                    {" · "}встречи: {user._count.createdMeetings}
                    {" · "}spaces: {user._count.memberships}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => startEdit(user)}>Редактировать</button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => {
                      if (window.confirm(`Удалить пользователя ${user.email}? Это действие нельзя отменить.`)) {
                        deleteUser.mutate(user.id);
                      }
                    }}
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

// ── Guard ──────────────────────────────────────────────────────────────────

const Guard = ({ children }: { children: ReactNode }) => {
  if (!hasToken()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

// ── App ────────────────────────────────────────────────────────────────────

export const App = () => (
  <Routes>
    <Route path="/login" element={<AuthPage mode="login" />} />
    <Route path="/register" element={<AuthPage mode="register" />} />
    <Route path="/meetings" element={<Guard><MeetingsPage /></Guard>} />
    <Route path="/meetings/:meetingId" element={<Guard><MeetingDetailsPage /></Guard>} />
    <Route path="/admin/runs" element={<Guard><AdminRunsPage /></Guard>} />
    <Route path="/admin/runs/:runId" element={<Guard><AdminRunDetailsPage /></Guard>} />
    <Route path="/admin/models" element={<Guard><AdminModelsPage /></Guard>} />
    <Route path="/admin/users" element={<Guard><AdminUsersPage /></Guard>} />
    <Route path="*" element={<Navigate to="/meetings" replace />} />
  </Routes>
);
