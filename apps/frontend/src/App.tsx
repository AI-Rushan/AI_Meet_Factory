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
  Activity,
  CreditCard,
  FolderOpen,
  HelpCircle,
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
          <SidebarLink to="/help" icon={<HelpCircle size={16} />} label="Помощь" />
          {isAdmin && (
            <SidebarLink to="/admin/dashboard" icon={<Activity size={16} />} label="Дашборд" />
          )}
          {isAdmin && (
            <SidebarLink to="/admin/runs" icon={<FileText size={16} />} label="Журнал обработок" />
          )}
          {isAdmin && (
            <SidebarLink to="/admin/models" icon={<Settings size={16} />} label="Настройки ИИ" />
          )}
          {isAdmin && (
            <SidebarLink to="/admin/users" icon={<Users size={16} />} label="Пользователи" />
          )}
          {isAdmin && (
            <SidebarLink to="/admin/subscriptions" icon={<CreditCard size={16} />} label="Подписки" />
          )}
          {isAdmin && (
            <SidebarLink to="/admin/archive" icon={<FolderOpen size={16} />} label="Архив" />
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
    if (resp.status === 403 && resp.data?.error === "EMAIL_NOT_VERIFIED")
      return "Email не подтверждён. Проверьте почту и перейдите по ссылке из письма.";
    if (resp.status === 403 && resp.data?.error === "USER_BLOCKED")
      return "Ваш аккаунт заблокирован. Обратитесь к администратору.";
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
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const payload =
        mode === "login"
          ? { email, password }
          : { email, password, name: name || undefined, workspaceName };
      const response = await api.post(endpoint, payload);
      return response.data as { token: string } | { pending: true; email: string };
    },
    onSuccess: (data) => {
      if ("pending" in data && data.pending) {
        setRegisteredEmail(data.email);
        return;
      }
      saveToken((data as { token: string }).token);
      navigate("/meetings");
    },
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate();
  };

  if (registeredEmail) {
    return (
      <div className="auth-wrap">
        <div className="card auth-card" style={{ textAlign: "center" }}>
          <BookOpen size={32} color="var(--accent)" />
          <h2 style={{ margin: "10px 0 4px", fontSize: "1.3em" }}>Проверьте почту</h2>
          <p style={{ margin: "0", color: "var(--muted)", fontSize: "0.9em", lineHeight: 1.6 }}>
            Мы отправили письмо на <strong>{registeredEmail}</strong>.
            <br />
            Перейдите по ссылке в письме, чтобы подтвердить email и войти в аккаунт.
          </p>
        </div>
      </div>
    );
  }

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
        {mode === "register" && (
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", fontSize: "0.85em", lineHeight: 1.5, color: "var(--muted)" }}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              style={{ marginTop: 2, flexShrink: 0, width: 16, height: 16, padding: 0, cursor: "pointer" }}
            />
            <span>
              Я ознакомлен с{" "}
              <Link to="/privacy-policy" target="_blank" rel="noreferrer">политикой конфиденциальности</Link>
              {" "}и согласен с{" "}
              <Link to="/personal-data" target="_blank" rel="noreferrer">условиями обработки ПД</Link>
            </span>
          </label>
        )}
        <button className="btn btn-primary" type="submit" disabled={mutation.isPending || (mode === "register" && !agreed)} style={{ width: "100%", justifyContent: "center", padding: "10px" }}>
          {mutation.isPending ? "Загрузка..." : mode === "login" ? "Войти" : "Создать аккаунт"}
        </button>

        {mutation.isError && (
          <p className="error" style={{ textAlign: "center" }}>{resolveAuthError(mutation.error)}</p>
        )}

        <p style={{ textAlign: "center", margin: 0, fontSize: "0.85em", color: "var(--muted)" }}>
          {mode === "login" ? (
            <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span>Нет аккаунта? <Link to="/register">Зарегистрируйтесь</Link></span>
              <span><Link to="/forgot-password">Забыли пароль?</Link></span>
            </span>
          ) : (
            <>Уже есть аккаунт? <Link to="/login">Войти</Link></>
          )}
        </p>
      </form>
    </div>
  );
};

// ── ForgotPasswordPage ─────────────────────────────────────────────────────

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      await api.post("/auth/forgot-password", { email });
    },
    onSuccess: () => setSent(true),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit}>
        <div style={{ textAlign: "center", marginBottom: 4 }}>
          <BookOpen size={32} color="var(--accent)" />
          <h2 style={{ margin: "10px 0 0", fontSize: "1.3em" }}>Восстановление пароля</h2>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "0.85em" }}>
            Введите email, и мы пришлём ссылку для сброса пароля
          </p>
        </div>

        {sent ? (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <p style={{ color: "var(--success)", marginBottom: 8 }}>
              Письмо отправлено! Проверьте почту и перейдите по ссылке.
            </p>
            <Link to="/login" style={{ fontSize: "0.85em" }}>Вернуться к входу</Link>
          </div>
        ) : (
          <>
            <input
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button className="btn btn-primary" type="submit" disabled={mutation.isPending} style={{ width: "100%", justifyContent: "center", padding: "10px" }}>
              {mutation.isPending ? "Отправка..." : "Отправить ссылку"}
            </button>
            {mutation.isError && (
              <p className="error" style={{ textAlign: "center" }}>Не удалось отправить письмо. Попробуйте позже.</p>
            )}
            <p style={{ textAlign: "center", margin: 0, fontSize: "0.85em", color: "var(--muted)" }}>
              <Link to="/login">Вернуться к входу</Link>
            </p>
          </>
        )}
      </form>
    </div>
  );
};

// ── ResetPasswordPage ──────────────────────────────────────────────────────

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [validationError, setValidationError] = useState("");

  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  const mutation = useMutation({
    mutationFn: async () => {
      await api.post("/auth/reset-password", { token, password });
    },
    onSuccess: () => {
      setTimeout(() => navigate("/login"), 2000);
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setValidationError("");
    if (password !== confirm) {
      setValidationError("Пароли не совпадают.");
      return;
    }
    if (password.length < 6) {
      setValidationError("Пароль должен быть не менее 6 символов.");
      return;
    }
    mutation.mutate();
  };

  if (!token) {
    return (
      <div className="auth-wrap">
        <div className="card auth-card" style={{ textAlign: "center" }}>
          <p className="error">Ссылка для сброса пароля недействительна.</p>
          <Link to="/forgot-password">Запросить новую ссылку</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit}>
        <div style={{ textAlign: "center", marginBottom: 4 }}>
          <BookOpen size={32} color="var(--accent)" />
          <h2 style={{ margin: "10px 0 0", fontSize: "1.3em" }}>Новый пароль</h2>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "0.85em" }}>
            Придумайте новый пароль для своего аккаунта
          </p>
        </div>

        {mutation.isSuccess ? (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <p style={{ color: "var(--success)" }}>Пароль успешно изменён! Перенаправление на вход...</p>
          </div>
        ) : (
          <>
            <input
              placeholder="Новый пароль (минимум 6 символов)"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <input
              placeholder="Повторите пароль"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
            <button className="btn btn-primary" type="submit" disabled={mutation.isPending} style={{ width: "100%", justifyContent: "center", padding: "10px" }}>
              {mutation.isPending ? "Сохранение..." : "Сохранить пароль"}
            </button>
            {validationError && <p className="error" style={{ textAlign: "center" }}>{validationError}</p>}
            {mutation.isError && (
              <p className="error" style={{ textAlign: "center" }}>
                {(mutation.error as { response?: { status: number } })?.response?.status === 400
                  ? "Ссылка устарела или недействительна. Запросите новую."
                  : "Не удалось сохранить пароль. Попробуйте позже."}
              </p>
            )}
          </>
        )}
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

const parseTitleDate = (title: string): number => {
  const match = title.match(/^(\d{2})[-_.](\d{2})[-_.](\d{4})/);
  if (!match) return 0;
  const [, dd, mm, yyyy] = match;
  return parseInt(`${yyyy}${mm}${dd}`, 10);
};

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
  const [sortBy, setSortBy] = useState<"title" | "transcribedAt">("title");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  };

  const meetings = useQuery({
    queryKey: ["meetings", debouncedSearch],
    queryFn: async () =>
      (await api.get("/me/meetings", {
        params: { search: debouncedSearch || undefined },
      })).data,
  });

  const sortedMeetings = useMemo(() => {
    if (!meetings.data) return [];
    return [...meetings.data].sort((a: any, b: any) => {
      if (sortBy === "transcribedAt") {
        const tA = a.transcript?.createdAt ? new Date(a.transcript.createdAt).getTime() : 0;
        const tB = b.transcript?.createdAt ? new Date(b.transcript.createdAt).getTime() : 0;
        if (tA === 0 && tB === 0) return 0;
        if (tA === 0) return 1;
        if (tB === 0) return -1;
        return order === "asc" ? tA - tB : tB - tA;
      }
      const dateA = parseTitleDate(a.title);
      const dateB = parseTitleDate(b.title);
      if (dateA !== 0 || dateB !== 0) {
        return order === "asc" ? dateA - dateB : dateB - dateA;
      }
      const cmp = a.title.localeCompare(b.title, "ru", { sensitivity: "base" });
      return order === "asc" ? cmp : -cmp;
    });
  }, [meetings.data, sortBy, order]);

  const createMeeting = useMutation({
    mutationFn: async () => (await api.post("/me/meetings", { title })).data,
    onSuccess: (data) => {
      setTitle("");
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      navigate(`/meetings/${data.id}`);
    },
  });

  const handleSort = (by: "title" | "transcribedAt") => {
    if (sortBy === by) {
      setOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(by);
      setOrder("desc");
    }
  };

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
          <button
            className={`btn btn-sm ${sortBy === "title" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => handleSort("title")}
            title="Сортировка по названию"
          >
            {sortBy === "title" && order === "asc" ? <ArrowDownAZ size={15} /> : <ArrowDownZA size={15} />}
            {sortBy === "title" && order === "asc" ? "А–Я" : "Я–А"}
          </button>
          <button
            className={`btn btn-sm ${sortBy === "transcribedAt" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => handleSort("transcribedAt")}
            title="Сортировка по дате транскрибации"
          >
            {sortBy === "transcribedAt" && order === "asc" ? <ArrowDownAZ size={15} /> : <ArrowDownZA size={15} />}
            Дата транскрибации
          </button>
        </div>

        {meetings.isLoading && <p className="muted">Загрузка...</p>}
        {meetings.isError && <p className="error">Не удалось загрузить встречи</p>}
        {!meetings.isLoading && sortedMeetings.length === 0 && (
          <p className="muted" style={{ margin: 0 }}>
            {debouncedSearch ? "Ничего не найдено." : "Нет встреч. Создайте первую выше."}
          </p>
        )}
        <div className="meeting-list">
          {sortedMeetings.map((meeting: any) => (
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
                  {meeting.transcript?.createdAt && (
                    <>транскрибирована: {new Date(meeting.transcript.createdAt).toLocaleString("ru")} · </>
                  )}
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
    const safeTitle = (meeting.data?.title ?? `meeting-${meetingId}`)
      .replace(/[/\\:*?"<>|]/g, "-")
      .trim();
    link.download = `${safeTitle}.txt`;
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
                {meetingData.transcript?.createdAt && (
                  <p style={{ margin: "4px 0 0", fontSize: "0.8em", color: "var(--muted)" }}>
                    Транскрибирована: {new Date(meetingData.transcript.createdAt).toLocaleString("ru")}
                  </p>
                )}
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
            {uploadMutation.isError && (
              <p className="error" style={{ marginTop: 8 }}>
                {(uploadMutation.error as any)?.response?.data?.error ?? (uploadMutation.error as any)?.message ?? "Ошибка загрузки файла"}
              </p>
            )}
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
                    <>
                      <p className="muted" style={{ fontSize: "0.85em", margin: "0 0 10px" }}>
                        Чтобы получать сообщения от бота, перейдите в{" "}
                        <a href="https://t.me/ru_meetings_ai_mvp_bot" target="_blank" rel="noreferrer">
                          @ru_meetings_ai_mvp_bot
                        </a>{" "}
                        и выполните команду <strong>/start</strong>.
                      </p>
                      <TelegramRecipientPicker selected={selectedChats} onChange={setSelectedChats} />
                    </>
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

const SUB_STATUS_LABEL: Record<string, string> = {
  free: "Бесплатный", trial: "Пробный", active: "Активна",
  grace: "Льготный", canceled: "Отменена", expired: "Истекла",
};
const SUB_STATUS_CLASS: Record<string, string> = {
  free: "badge-created", trial: "badge-processing", active: "badge-ready",
  grace: "badge-processing", canceled: "badge-failed", expired: "badge-failed",
};

const DashCard = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
  <div className="card" style={{ flex: 1, minWidth: 160, textAlign: "center", padding: "18px 16px" }}>
    <p style={{ margin: "0 0 4px", fontSize: "0.78em", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
    <p style={{ margin: 0, fontSize: "1.6em", fontWeight: 700 }}>{value}</p>
    {sub && <p style={{ margin: "2px 0 0", fontSize: "0.75em", color: "var(--muted)" }}>{sub}</p>}
  </div>
);

const AdminDashboardPage = () => {
  const [sortCol, setSortCol] = useState<string>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const dashboard = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: async () => (await api.get("/admin/dashboard")).data,
    refetchInterval: 60_000,
  });

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("desc"); }
  };

  const sorted = useMemo(() => {
    if (!dashboard.data?.users) return [];
    return [...dashboard.data.users].sort((a: any, b: any) => {
      const av = a[sortCol] ?? 0;
      const bv = b[sortCol] ?? 0;
      const cmp = typeof av === "string" ? av.localeCompare(bv, "ru") : av - bv;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [dashboard.data, sortCol, sortDir]);

  const t = dashboard.data?.totals;

  const Th = ({ col, label }: { col: string; label: string }) => (
    <th
      onClick={() => toggleSort(col)}
      style={{ cursor: "pointer", whiteSpace: "nowrap", userSelect: "none", padding: "6px 10px", fontSize: "0.75em", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)", borderBottom: "1px solid var(--line)" }}
    >
      {label}{sortCol === col ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
    </th>
  );

  return (
    <AppShell>
      {/* Карточки-итоги */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 0 }}>
        <DashCard label="Пользователей" value={t?.totalUsers ?? "—"} />
        <DashCard label="Встреч обработано" value={t?.totalMeetingsProcessed ?? "—"} />
        <DashCard label="Стоимость AI" value={t ? `$${t.totalAiCostUsd}` : "—"} sub="себестоимость" />
        <DashCard label="Оплачено подписок" value={t ? `${t.totalPaidRub.toLocaleString("ru")} ₽` : "—"} />
      </div>

      {/* Таблица пользователей */}
      <section className="card" style={{ overflowX: "auto" }}>
        <h2 style={{ margin: "0 0 14px", fontSize: "1.05em" }}>Аналитика по пользователям</h2>

        {dashboard.isLoading && <p className="muted">Загрузка...</p>}
        {dashboard.isError && <p className="error">Не удалось загрузить данные</p>}

        {sorted.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85em" }}>
            <thead>
              <tr>
                <Th col="email" label="Пользователь" />
                <Th col="createdAt" label="Зарегистрирован" />
                <Th col="daysSinceReg" label="Дней" />
                <Th col="loginCount" label="Сессий" />
                <Th col="lastActiveAt" label="Последняя активность" />
                <th style={{ padding: "6px 10px", fontSize: "0.75em", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>Подписка</th>
                <Th col="meetingsProcessed" label="Встреч" />
                <Th col="audioHours" label="Часов аудио" />
                <Th col="aiCostUsd" label="AI, $" />
                <Th col="paidRub" label="Оплачено, ₽" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((u: any) => (
                <tr key={u.id} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "8px 10px" }}>
                    <p style={{ margin: 0, fontWeight: 600 }}>{u.email}</p>
                    {u.name && <p style={{ margin: 0, fontSize: "0.82em", color: "var(--muted)" }}>{u.name}</p>}
                    <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                      {u.isAdmin && <span className="badge badge-admin" style={{ fontSize: "0.7em" }}>ADMIN</span>}
                      {u.isBlocked && <span className="badge badge-failed" style={{ fontSize: "0.7em" }}>БЛОК</span>}
                    </div>
                  </td>
                  <td style={{ padding: "8px 10px", whiteSpace: "nowrap", color: "var(--muted)" }}>
                    {new Date(u.createdAt).toLocaleDateString("ru")}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>{u.daysSinceReg}</td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>{u.loginCount}</td>
                  <td style={{ padding: "8px 10px", whiteSpace: "nowrap", color: "var(--muted)", fontSize: "0.82em" }}>
                    {u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleString("ru") : "—"}
                  </td>
                  <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                    {u.subscription ? (
                      <div>
                        <span className={`badge ${SUB_STATUS_CLASS[u.subscription.status] ?? "badge-created"}`}>
                          {SUB_STATUS_LABEL[u.subscription.status] ?? u.subscription.status}
                        </span>
                        <p style={{ margin: "2px 0 0", fontSize: "0.8em", color: "var(--muted)" }}>
                          {u.subscription.planName}
                          {u.subscription.expiresAt && ` · до ${new Date(u.subscription.expiresAt).toLocaleDateString("ru")}`}
                        </p>
                      </div>
                    ) : <span style={{ color: "var(--muted)" }}>—</span>}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>{u.meetingsProcessed}</td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>{u.audioHours}</td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>
                    {u.aiCostUsd > 0 ? `$${u.aiCostUsd}` : "—"}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>
                    {u.paidRub > 0 ? `${u.paidRub.toLocaleString("ru")} ₽` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </AppShell>
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

type LlmPreset = {
  name: string;
  provider: string;
  model: string;
  tier: "free" | "paid";
  price: string;
  description: string;
  envVar: string;
};

const LLM_PRESETS: LlmPreset[] = [
  {
    name: "Groq LLaMA-3.3-70b",
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    tier: "free",
    price: "Бесплатно",
    description: "Быстрая и бесплатная LLaMA через Groq API. Лимит: 30 req/мин, 6000 req/день.",
    envVar: "GROQ_API_KEY",
  },
  {
    name: "Mock (разработка)",
    provider: "mock",
    model: "-",
    tier: "free",
    price: "Бесплатно",
    description: "Возвращает фиктивные данные. Только для тестирования без API-ключей.",
    envVar: "—",
  },
  {
    name: "OpenAI GPT-4o",
    provider: "openai",
    model: "gpt-4o",
    tier: "paid",
    price: "$2.50/1M",
    description: "Лучшее качество саммари и задач. Флагманская модель OpenAI.",
    envVar: "OPENAI_API_KEY",
  },
  {
    name: "OpenAI GPT-4o-mini",
    provider: "openai",
    model: "gpt-4o-mini",
    tier: "paid",
    price: "$0.15/1M",
    description: "Быстрее и дешевле GPT-4o, качество чуть ниже.",
    envVar: "OPENAI_API_KEY",
  },
  {
    name: "Google Gemini 2.0 Flash",
    provider: "gemini",
    model: "gemini-2.0-flash",
    tier: "paid",
    price: "$0.10/1M",
    description: "Быстрая модель Google с хорошим качеством на русском.",
    envVar: "GEMINI_API_KEY",
  },
];

const LlmPresetSelector = ({
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

  const freePresets = LLM_PRESETS.filter((p) => p.tier === "free");
  const paidPresets = LLM_PRESETS.filter((p) => p.tier === "paid");

  const renderPreset = (preset: LlmPreset) => {
    const isActive = preset.provider === activeProvider && preset.model === activeModel;
    return (
      <div key={preset.provider + preset.model} className={`model-card${isActive ? " active" : ""}`}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
            <strong style={{ fontSize: "0.95em" }}>{preset.name}</strong>
            <span className={`badge badge-${preset.tier}`}>{preset.price}</span>
            {isActive && <span className="badge badge-active">АКТИВНА</span>}
          </div>
          <p style={{ margin: 0, fontSize: "0.82em", color: "var(--muted)" }}>{preset.description}</p>
          <p style={{ margin: "4px 0 0", fontSize: "0.78em", color: "#9ca3af" }}>
            Требует: <code style={{ background: "var(--surface-2)", padding: "1px 5px", borderRadius: 4 }}>{preset.envVar}</code>
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
        <button className="btn btn-ghost btn-sm" onClick={() => setShowCustom((v) => !v)}>
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
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, ok });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  const models = useQuery({
    queryKey: ["admin-models"],
    queryFn: async () => (await api.get("/admin/models")).data,
  });

  const update = useMutation({
    mutationFn: async (payload: { purpose: "transcription" | "postprocessing"; provider: string; model: string }) =>
      (await api.put(`/admin/models/${payload.purpose}`, { provider: payload.provider, model: payload.model })).data,
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-models"] });
      const label = vars.purpose === "transcription" ? "Транскрипция" : "Постобработка";
      showToast(`✓ ${label}: ${vars.provider}/${vars.model} активирована`, true);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error ?? err?.message ?? "Неизвестная ошибка";
      showToast(`Ошибка: ${msg}`, false);
    },
  });

  const activeTranscription = models.data?.find((item: any) => item.purpose === "transcription" && item.isActive);
  const activePostprocessing = models.data?.find((item: any) => item.purpose === "postprocessing" && item.isActive);

  const handleActivate = (purpose: "transcription" | "postprocessing") =>
    (provider: string, model: string) => {
      update.mutate({ purpose, provider, model });
    };

  return (
    <AppShell>
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 9999,
          background: toast.ok ? "var(--success, #16a34a)" : "var(--error, #dc2626)",
          color: "#fff", padding: "10px 18px", borderRadius: 8,
          boxShadow: "0 4px 16px rgba(0,0,0,0.18)", fontSize: "0.9em", maxWidth: 380,
        }}>
          {toast.msg}
        </div>
      )}
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
        {activePostprocessing ? (
          <LlmPresetSelector
            activeProvider={activePostprocessing.provider}
            activeModel={activePostprocessing.model}
            onActivate={handleActivate("postprocessing")}
            isPending={update.isPending}
          />
        ) : (
          models.isLoading ? <p className="muted">Загрузка...</p> : null
        )}
      </section>
    </AppShell>
  );
};

// ── Admin Users ────────────────────────────────────────────────────────────

const UserMenu = ({
  user,
  onEdit,
  onDelete,
}: {
  user: any;
  onEdit: () => void;
  onDelete: () => void;
}) => {
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

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        className="btn btn-ghost btn-sm"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        title="Действия"
        style={{ padding: "4px 8px" }}
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div className="dropdown-menu">
          <button
            className="dropdown-item"
            onClick={() => { setOpen(false); onEdit(); }}
          >
            Редактировать
          </button>
          <button
            className="dropdown-item danger"
            onClick={() => { setOpen(false); onDelete(); }}
          >
            <Trash2 size={14} /> Удалить
          </button>
        </div>
      )}
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
  const [editIsBlocked, setEditIsBlocked] = useState(false);
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
      const payload: Record<string, unknown> = { email: editEmail, name: editName || null, isAdmin: editIsAdmin, isBlocked: editIsBlocked };
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
    setEditIsBlocked(user.isBlocked);
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
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto auto auto auto", gap: 8 }}>
                  <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="Email" />
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Имя" />
                  <input value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="Новый пароль (необязательно)" type="password" />
                  <label style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", fontSize: "0.9em" }}>
                    <input type="checkbox" checked={editIsAdmin} onChange={(e) => setEditIsAdmin(e.target.checked)} />
                    Admin
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", fontSize: "0.9em", color: editIsBlocked ? "var(--error, #ef4444)" : undefined }}>
                    <input type="checkbox" checked={editIsBlocked} onChange={(e) => setEditIsBlocked(e.target.checked)} />
                    Заблокирован
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
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <strong>{user.email}</strong>
                    {user.name && <span className="muted" style={{ fontSize: "0.9em" }}>{user.name}</span>}
                    {user.isAdmin && <span className="badge badge-admin">ADMIN</span>}
                    {user.isBlocked && <span className="badge badge-failed">ЗАБЛОКИРОВАН</span>}
                  </div>
                  <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.8em" }}>
                    Зарегистрирован: {new Date(user.createdAt).toLocaleDateString("ru")}
                    {" · "}сессий: {user.loginCount}
                    {" · "}последняя активность: {user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleString("ru") : "—"}
                    {" · "}встречи: {user._count.createdMeetings}
                  </p>
                </div>
                <UserMenu
                  user={user}
                  onEdit={() => startEdit(user)}
                  onDelete={() => {
                    if (window.confirm(`Удалить пользователя ${user.email}? Это действие нельзя отменить.`)) {
                      deleteUser.mutate(user.id);
                    }
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </section>
    </AppShell>
  );
};

// ── HelpPage ───────────────────────────────────────────────────────────────

const HelpSection = ({ title, children }: { title: string; children: ReactNode }) => (
  <div style={{ marginBottom: 28 }}>
    <h3 style={{ margin: "0 0 10px", fontSize: "1em", fontWeight: 700 }}>{title}</h3>
    {children}
  </div>
);

const HelpPage = () => (
  <AppShell>
    <section className="card" style={{ maxWidth: 720 }}>
      <h2 style={{ margin: "0 0 24px" }}>Инструкция по использованию</h2>

      <HelpSection title="1. Регистрация и вход">
        <p style={{ margin: "0 0 8px", lineHeight: 1.7 }}>
          Перейдите на сайт и нажмите <strong>«Зарегистрироваться»</strong> — введите email, пароль и отметьте согласие с политикой конфиденциальности.
        </p>
        <p style={{ margin: "0 0 8px", lineHeight: 1.7 }}>
          После регистрации на указанный email придёт письмо со ссылкой для подтверждения. Войти в продукт можно только после перехода по этой ссылке.
        </p>
        <p style={{ margin: 0, lineHeight: 1.7 }}>
          Если аккаунт уже есть, нажмите <strong>«Войти»</strong>. Забыли пароль — воспользуйтесь ссылкой <strong>«Забыли пароль?»</strong> на странице входа.
        </p>
      </HelpSection>

      <HelpSection title="2. Список встреч">
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
          <li>Каждая карточка показывает дату транскрибации, количество задач и спикеров</li>
          <li>Сортировка по названию — кнопка <strong>А–Я / Я–А</strong></li>
          <li>Сортировка по дате транскрибации — кнопка <strong>Дата транскрибации</strong>; встречи без транскрипции остаются в конце</li>
          <li>Повторный клик по активной кнопке сортировки меняет направление</li>
          <li>Удаление встречи — меню <strong>«⋯»</strong> в карточке</li>
          <li>Рекомендуется начинать название с даты: <code style={{ background: "var(--surface-2)", padding: "1px 6px", borderRadius: 4 }}>27-05-2026 Встреча с клиентом</code> — это позволяет сортировать хронологически</li>
        </ul>
      </HelpSection>

      <HelpSection title="3. Создание встречи">
        <p style={{ margin: 0, lineHeight: 1.7 }}>
          Нажмите <strong>«Новая встреча»</strong>, введите название, нажмите <strong>«Создать»</strong>.
          После этого загрузите аудио или видеофайл для транскрибации.
        </p>
      </HelpSection>

      <HelpSection title="4. Загрузка файла и транскрибация">
        <p style={{ margin: "0 0 8px", lineHeight: 1.7 }}>
          Откройте встречу и нажмите <strong>«Загрузить аудио/видео»</strong>, выберите файл, затем нажмите <strong>«Транскрибировать»</strong>. После загрузки начнётся автоматическая обработка (обычно 1–5 минут). Страница обновляется автоматически.
        </p>
        <p style={{ margin: "0 0 8px", lineHeight: 1.7 }}>
          После завершения в шапке встречи появится <strong>дата транскрибации</strong> — она также отображается в списке встреч.
        </p>
        <p style={{ margin: 0, fontSize: "0.85em", color: "var(--muted)" }}>
          Поддерживаемые форматы: MP3, WAV, M4A, MP4, WebM, OGG, FLAC, AAC, MKV
        </p>
      </HelpSection>

      <HelpSection title="5. Вкладки встречи">
        {[
          {
            name: "Транскрипция",
            desc: "Полный текст с метками времени и именами спикеров. Можно искать по тексту, редактировать содержимое, переназначать спикеров и скачать файл .txt (сохраняется с именем встречи).",
          },
          {
            name: "Спикеры",
            desc: "Список участников, определённых ИИ. Можно подтвердить или исправить имя каждого спикера. Если кто-то не был определён автоматически — добавьте спикера вручную через форму внизу раздела.",
          },
          {
            name: "Саммари",
            desc: "Краткое содержание встречи: темы обсуждения и принятые решения. Нажмите «Получить саммари» для генерации.",
          },
          {
            name: "Задачи",
            desc: "Задачи, автоматически извлечённые из разговора. Генерируются вместе с саммари. Можно редактировать, указывать ответственного и срок, добавлять задачи вручную.",
          },
          {
            name: "Чат",
            desc: "Задайте любой вопрос по содержимому встречи. Например: «Что решили по бюджету?» или «Кто отвечает за маркетинг?»",
          },
          {
            name: "Экспорт",
            desc: "Отправка саммари и задач на Email или в Telegram. Для Telegram: найдите бота @ru_meetings_ai_mvp_bot, выполните /start, затем вернитесь в приложение.",
          },
        ].map(({ name, desc }) => (
          <div key={name} style={{ marginBottom: 10 }}>
            <strong>{name}</strong>
            <p style={{ margin: "2px 0 0", fontSize: "0.9em", lineHeight: 1.6, color: "var(--muted)" }}>{desc}</p>
          </div>
        ))}
      </HelpSection>

      <HelpSection title="6. Частые вопросы">
        {[
          ["Письмо с подтверждением не пришло", "Проверьте папку «Спам». Если письма нет — обратитесь к администратору."],
          ["Не могу войти после регистрации", "Убедитесь, что перешли по ссылке из письма для подтверждения email."],
          ["Встреча долго обрабатывается", "Страница обновляется автоматически — просто подождите. Обычно обработка занимает 1–5 минут."],
          ["Дата транскрибации не отображается", "Дата появляется только после завершения транскрибации. Загрузите аудио/видео файл и дождитесь окончания обработки."],
          ["Спикеры определены неправильно", "Вкладка «Транскрипция» → кнопка «Редактировать» → исправьте вручную."],
          ["Нужного спикера нет в списке", "Вкладка «Спикеры» → форма внизу → добавьте спикера вручную."],
          ["Саммари на неправильном языке", "Саммари генерируется на языке аудиозаписи."],
        ].map(([q, a]) => (
          <div key={q} style={{ marginBottom: 10 }}>
            <strong style={{ fontSize: "0.9em" }}>{q}</strong>
            <p style={{ margin: "2px 0 0", fontSize: "0.88em", lineHeight: 1.6, color: "var(--muted)" }}>{a}</p>
          </div>
        ))}
      </HelpSection>
    </section>
  </AppShell>
);

// ── PrivacyPolicyPage ──────────────────────────────────────────────────────

const PrivacyPolicyPage = () => (
  <div style={{ maxWidth: 720, margin: "40px auto", padding: "0 24px" }}>
    <div className="card">
      <h1 style={{ margin: "0 0 8px", fontSize: "1.4em" }}>Политика конфиденциальности</h1>
      <p style={{ margin: "0 0 24px", color: "var(--muted)", fontSize: "0.85em" }}>
        AI Meet Factory
      </p>
      <p style={{ color: "var(--muted)", lineHeight: 1.7 }}>
        Содержание политики конфиденциальности будет добавлено позже.
      </p>
      <div style={{ marginTop: 24 }}>
        <Link to="/register" style={{ fontSize: "0.85em" }}>← Вернуться к регистрации</Link>
      </div>
    </div>
  </div>
);

// ── PersonalDataPage ───────────────────────────────────────────────────────

const PersonalDataPage = () => (
  <div style={{ maxWidth: 720, margin: "40px auto", padding: "0 24px" }}>
    <div className="card">
      <h1 style={{ margin: "0 0 8px", fontSize: "1.4em" }}>Условия обработки персональных данных</h1>
      <p style={{ margin: "0 0 24px", color: "var(--muted)", fontSize: "0.85em" }}>
        AI Meet Factory
      </p>
      <p style={{ color: "var(--muted)", lineHeight: 1.7 }}>
        Содержание условий обработки персональных данных будет добавлено позже.
      </p>
      <div style={{ marginTop: 24 }}>
        <Link to="/register" style={{ fontSize: "0.85em" }}>← Вернуться к регистрации</Link>
      </div>
    </div>
  </div>
);

// ── VerifyEmailPage ────────────────────────────────────────────────────────

const VerifyEmailPage = () => {
  const navigate = useNavigate();
  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  const { data, isLoading, isError } = useQuery({
    queryKey: ["verify-email", token],
    queryFn: async () => {
      const response = await api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`);
      return response.data as { token: string };
    },
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (data) {
      saveToken(data.token);
      setTimeout(() => navigate("/meetings"), 2000);
    }
  }, [data, navigate]);

  if (!token) {
    return (
      <div className="auth-wrap">
        <div className="card auth-card" style={{ textAlign: "center" }}>
          <p className="error">Ссылка для подтверждения недействительна.</p>
          <Link to="/register">Зарегистрироваться заново</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <div className="card auth-card" style={{ textAlign: "center" }}>
        <BookOpen size={32} color="var(--accent)" />
        {isLoading && (
          <p style={{ margin: "14px 0 0", color: "var(--muted)" }}>Подтверждение email…</p>
        )}
        {data && (
          <>
            <h2 style={{ margin: "10px 0 4px", fontSize: "1.3em" }}>Email подтверждён!</h2>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9em" }}>
              Перенаправление в приложение…
            </p>
          </>
        )}
        {isError && (
          <>
            <p className="error" style={{ margin: "14px 0 8px" }}>
              Ссылка устарела или недействительна.
            </p>
            <Link to="/register" style={{ fontSize: "0.85em" }}>Зарегистрироваться заново</Link>
          </>
        )}
      </div>
    </div>
  );
};

// ── AdminSubscriptionsPage ────────────────────────────────────────────────

const STATUS_LABEL_SUB: Record<string, string> = {
  free: "Бесплатный", trial: "Пробный", active: "Активна",
  grace: "Льготный период", canceled: "Отменена", expired: "Истекла",
};
const STATUS_CLASS_SUB: Record<string, string> = {
  free: "badge-created", trial: "badge-processing", active: "badge-ready",
  grace: "badge-processing", canceled: "badge-failed", expired: "badge-failed",
};

const AdminSubscriptionsPage = () => {
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [showForm, setShowForm] = useState(false);

  // Форма назначения подписки
  const [planId, setPlanId] = useState("");
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly" | "">("");
  const [status, setStatus] = useState("active");
  const [expiresAt, setExpiresAt] = useState("");
  const [subNote, setSubNote] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");

  const users = useQuery({
    queryKey: ["admin-users-sub"],
    queryFn: async () => (await api.get("/admin/users")).data,
  });

  const plans = useQuery({
    queryKey: ["admin-plans"],
    queryFn: async () => (await api.get("/admin/plans")).data,
  });

  const userSubs = useQuery({
    queryKey: ["admin-user-subs", selectedUserId],
    queryFn: async () => (await api.get(`/admin/users/${selectedUserId}/subscriptions`)).data,
    enabled: !!selectedUserId,
  });

  const assign = useMutation({
    mutationFn: async () => api.post(`/admin/users/${selectedUserId}/subscriptions`, {
      planId,
      billingPeriod: billingPeriod || undefined,
      status,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      note: subNote || undefined,
      paymentAmount: paymentAmount ? Number(paymentAmount) : undefined,
      paymentNote: paymentNote || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-user-subs", selectedUserId] });
      setPlanId(""); setBillingPeriod(""); setStatus("active");
      setExpiresAt(""); setSubNote(""); setPaymentAmount(""); setPaymentNote("");
      setShowForm(false);
    },
  });

  const cancelSub = useMutation({
    mutationFn: async (subId: string) =>
      api.patch(`/admin/subscriptions/${subId}`, { status: "canceled", cancelReason: "Отменена администратором" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-user-subs", selectedUserId] }),
  });

  const nonArchivistUsers = (users.data ?? []).filter((u: any) => !u.isArchivist);
  const selectedUser = nonArchivistUsers.find((u: any) => u.id === selectedUserId);

  return (
    <AppShell>
      <section className="card">
        <h2 style={{ margin: "0 0 16px" }}>Управление подписками</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select
            title="Выберите пользователя"
            value={selectedUserId}
            onChange={(e) => { setSelectedUserId(e.target.value); setShowForm(false); }}
            style={{ flex: 1, minWidth: 240 }}
          >
            <option value="">— выберите пользователя —</option>
            {nonArchivistUsers.map((u: any) => (
              <option key={u.id} value={u.id}>
                {u.email}{u.name ? ` (${u.name})` : ""}
              </option>
            ))}
          </select>
          {selectedUserId && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
              <Plus size={14} /> {showForm ? "Отмена" : "Назначить подписку"}
            </button>
          )}
        </div>
      </section>

      {selectedUserId && showForm && (
        <section className="card">
          <h3 style={{ margin: "0 0 14px", fontSize: "1em" }}>
            Новая подписка — {selectedUser?.email}
          </h3>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <div>
                <p style={{ margin: "0 0 4px", fontSize: "0.8em", color: "var(--muted)" }}>Тариф *</p>
                <select title="Тариф" value={planId} onChange={(e) => setPlanId(e.target.value)} style={{ width: "100%" }}>
                  <option value="">— выберите —</option>
                  {(plans.data ?? []).map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.priceMonthly === 0 ? "Бесплатно" : `${p.priceMonthly} ₽/мес`})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p style={{ margin: "0 0 4px", fontSize: "0.8em", color: "var(--muted)" }}>Статус</p>
                <select title="Статус" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: "100%" }}>
                  <option value="free">Бесплатный</option>
                  <option value="active">Активна</option>
                  <option value="trial">Пробный</option>
                </select>
              </div>
              <div>
                <p style={{ margin: "0 0 4px", fontSize: "0.8em", color: "var(--muted)" }}>Период</p>
                <select title="Период" value={billingPeriod} onChange={(e) => setBillingPeriod(e.target.value as any)} style={{ width: "100%" }}>
                  <option value="">— не указан —</option>
                  <option value="monthly">Месяц</option>
                  <option value="yearly">Год</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <p style={{ margin: "0 0 4px", fontSize: "0.8em", color: "var(--muted)" }}>Действует до</p>
                <input type="datetime-local" title="Дата окончания подписки" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} style={{ width: "100%" }} />
              </div>
              <div>
                <p style={{ margin: "0 0 4px", fontSize: "0.8em", color: "var(--muted)" }}>Комментарий к подписке</p>
                <input value={subNote} onChange={(e) => setSubNote(e.target.value)} placeholder="Необязательно" style={{ width: "100%" }} />
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
              <p style={{ margin: "0 0 8px", fontSize: "0.85em", fontWeight: 600 }}>Платёж (необязательно)</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <p style={{ margin: "0 0 4px", fontSize: "0.8em", color: "var(--muted)" }}>Сумма, ₽</p>
                  <input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="490" style={{ width: "100%" }} />
                </div>
                <div>
                  <p style={{ margin: "0 0 4px", fontSize: "0.8em", color: "var(--muted)" }}>Комментарий к платежу</p>
                  <input value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="Необязательно" style={{ width: "100%" }} />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>Отмена</button>
              <button
                className="btn btn-primary"
                onClick={() => assign.mutate()}
                disabled={!planId || assign.isPending}
              >
                {assign.isPending ? "Сохранение..." : "Назначить подписку"}
              </button>
            </div>
            {assign.isError && <p className="error">Не удалось назначить подписку</p>}
          </div>
        </section>
      )}

      {selectedUserId && (
        <section className="card">
          <h3 style={{ margin: "0 0 14px", fontSize: "1em" }}>
            История подписок — {selectedUser?.email}
          </h3>
          {userSubs.isLoading && <p className="muted">Загрузка...</p>}
          {!userSubs.isLoading && userSubs.data?.length === 0 && (
            <p className="muted">Подписок нет.</p>
          )}
          {userSubs.data?.map((sub: any) => (
            <div key={sub.id} style={{ borderBottom: "1px solid var(--line)", padding: "10px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <strong style={{ fontSize: "0.95em" }}>{sub.plan?.name ?? sub.planCode}</strong>
                  <span className={`badge ${STATUS_CLASS_SUB[sub.status] ?? "badge-created"}`}>
                    {STATUS_LABEL_SUB[sub.status] ?? sub.status}
                  </span>
                  {sub.billingPeriod && (
                    <span className="muted" style={{ fontSize: "0.8em" }}>
                      {sub.billingPeriod === "monthly" ? "Месяц" : "Год"}
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: "0.8em", color: "var(--muted)" }}>
                  С {new Date(sub.startedAt).toLocaleDateString("ru")}
                  {sub.expiresAt && ` · до ${new Date(sub.expiresAt).toLocaleDateString("ru")}`}
                  {sub.payments?.length > 0 && ` · оплачено: ${sub.payments.reduce((s: number, p: any) => s + p.amount, 0)} ₽`}
                  {sub.note && ` · ${sub.note}`}
                </p>
                {sub.cancelReason && (
                  <p style={{ margin: "2px 0 0", fontSize: "0.78em", color: "var(--muted)" }}>
                    Причина отмены: {sub.cancelReason}
                  </p>
                )}
              </div>
              {(sub.status === "active" || sub.status === "trial" || sub.status === "grace") && (
                <button
                  className="btn btn-danger btn-sm"
                  style={{ flexShrink: 0 }}
                  onClick={() => cancelSub.mutate(sub.id)}
                  disabled={cancelSub.isPending}
                >
                  Отменить
                </button>
              )}
            </div>
          ))}
        </section>
      )}
    </AppShell>
  );
};

// ── AdminArchivePage ──────────────────────────────────────────────────────

const AdminArchivePage = () => {
  const queryClient = useQueryClient();
  const [transferUserId, setTransferUserId] = useState<Record<string, string>>({});

  const archivist = useQuery({
    queryKey: ["archivist"],
    queryFn: async () => (await api.get("/admin/archivist/setup").catch(() => null))?.data ?? null,
    retry: false,
  });

  const setupArchivist = useMutation({
    mutationFn: async () => (await api.post("/admin/archivist/setup")).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["archivist", "archive-workspaces"] }),
  });

  const workspaces = useQuery({
    queryKey: ["archive-workspaces"],
    queryFn: async () => (await api.get("/admin/workspaces")).data,
    enabled: !!archivist.data,
  });

  const users = useQuery({
    queryKey: ["admin-users-list"],
    queryFn: async () => (await api.get("/admin/users")).data,
  });

  const transfer = useMutation({
    mutationFn: async ({ workspaceId, targetUserId }: { workspaceId: string; targetUserId: string }) =>
      api.post(`/admin/workspaces/${workspaceId}/transfer`, { targetUserId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["archive-workspaces"] }),
  });

  const nonArchivistUsers = (users.data ?? []).filter((u: any) => !u.isArchivist);

  return (
    <AppShell>
      <section className="card">
        <h2 style={{ margin: "0 0 16px" }}>Архивариус</h2>
        {!archivist.data ? (
          <div>
            <p style={{ margin: "0 0 12px", color: "var(--muted)", fontSize: "0.9em", lineHeight: 1.6 }}>
              Аккаунт-архивариус не создан. Он нужен для хранения данных удалённых пользователей.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => setupArchivist.mutate()}
              disabled={setupArchivist.isPending}
            >
              {setupArchivist.isPending ? "Создание..." : "Создать архивариуса"}
            </button>
            {setupArchivist.isError && <p className="error" style={{ marginTop: 8 }}>Не удалось создать архивариуса</p>}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: "0.9em" }}>
            Активен: <strong>{archivist.data.email}</strong> — данные удалённых пользователей хранятся здесь.
          </p>
        )}
      </section>

      {archivist.data && (
        <section className="card">
          <h2 style={{ margin: "0 0 4px" }}>Workspace-сироты</h2>
          <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: "0.85em" }}>
            Workspace удалённых пользователей. Переназначьте владельца, чтобы передать доступ.
          </p>

          {workspaces.isLoading && <p className="muted">Загрузка...</p>}
          {!workspaces.isLoading && workspaces.data?.length === 0 && (
            <p className="muted">Нет workspace-сирот.</p>
          )}

          {workspaces.data?.map((ws: any) => (
            <div key={ws.id} style={{ borderBottom: "1px solid var(--line)", padding: "12px 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <FolderOpen size={15} color="var(--accent)" />
                  <strong style={{ fontSize: "0.95em" }}>{ws.name}</strong>
                  <span className="muted" style={{ fontSize: "0.8em" }}>· встреч: {ws._count.meetings}</span>
                </div>
                {ws.originalOwnerEmail && (
                  <p style={{ margin: "2px 0 0", fontSize: "0.8em", color: "var(--muted)" }}>
                    Создан: {ws.originalOwnerEmail}
                  </p>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select
                  title="Выберите пользователя для передачи workspace"
                  value={transferUserId[ws.id] ?? ""}
                  onChange={(e) => setTransferUserId((prev) => ({ ...prev, [ws.id]: e.target.value }))}
                  style={{ fontSize: "0.85em" }}
                >
                  <option value="">— выберите пользователя —</option>
                  {nonArchivistUsers.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.email}{u.name ? ` (${u.name})` : ""}</option>
                  ))}
                </select>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={!transferUserId[ws.id] || transfer.isPending}
                  onClick={() => transfer.mutate({ workspaceId: ws.id, targetUserId: transferUserId[ws.id] })}
                >
                  Передать
                </button>
              </div>
            </div>
          ))}
          {transfer.isError && <p className="error" style={{ marginTop: 8 }}>Не удалось переназначить workspace</p>}
        </section>
      )}
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
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route path="/verify-email" element={<VerifyEmailPage />} />
    <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
    <Route path="/personal-data" element={<PersonalDataPage />} />
    <Route path="/help" element={<Guard><HelpPage /></Guard>} />
    <Route path="/meetings" element={<Guard><MeetingsPage /></Guard>} />
    <Route path="/meetings/:meetingId" element={<Guard><MeetingDetailsPage /></Guard>} />
    <Route path="/admin/dashboard" element={<Guard><AdminDashboardPage /></Guard>} />
    <Route path="/admin/runs" element={<Guard><AdminRunsPage /></Guard>} />
    <Route path="/admin/runs/:runId" element={<Guard><AdminRunDetailsPage /></Guard>} />
    <Route path="/admin/models" element={<Guard><AdminModelsPage /></Guard>} />
    <Route path="/admin/users" element={<Guard><AdminUsersPage /></Guard>} />
    <Route path="/admin/subscriptions" element={<Guard><AdminSubscriptionsPage /></Guard>} />
    <Route path="/admin/archive" element={<Guard><AdminArchivePage /></Guard>} />
    <Route path="*" element={<Navigate to="/meetings" replace />} />
  </Routes>
);
