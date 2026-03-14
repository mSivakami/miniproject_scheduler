const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  getTeachers: () => req("GET", "/teachers"),
  createTeacher: (b) => req("POST", "/teachers", b),
  updateTeacher: (id, b) => req("PUT", `/teachers/${id}`, b),
  deleteTeacher: (id) => req("DELETE", `/teachers/${id}`),

  getSubjects: () => req("GET", "/subjects"),
  createSubject: (b) => req("POST", "/subjects", b),
  updateSubject: (id, b) => req("PUT", `/subjects/${id}`, b),
  deleteSubject: (id) => req("DELETE", `/subjects/${id}`),

  getRooms: () => req("GET", "/rooms"),
  createRoom: (b) => req("POST", "/rooms", b),
  updateRoom: (id, b) => req("PUT", `/rooms/${id}`, b),
  deleteRoom: (id) => req("DELETE", `/rooms/${id}`),

  getClasses: () => req("GET", "/classes"),
  createClass: (b) => req("POST", "/classes", b),
  updateClass: (id, b) => req("PUT", `/classes/${id}`, b),
  deleteClass: (id) => req("DELETE", `/classes/${id}`),

  getLessons: () => req("GET", "/lessons"),
  createLesson: (b) => req("POST", "/lessons", b),
  updateLesson: (id, b) => req("PUT", `/lessons/${id}`, b),
  deleteLesson: (id) => req("DELETE", `/lessons/${id}`),

  getBreaks: () => req("GET", "/breaks"),
  createBreak: (b) => req("POST", "/breaks", b),
  deleteBreak: (day, period) => req("DELETE", `/breaks/${day}/${period}`),

  generate: () => req("POST", "/generate"),
};
