const PASS_MARK = 35;
const STORAGE_KEY = "marksheetStudents";
const DEFAULT_SUBJECTS = ["Web Technology", "Database Management", "Programming"];

const $ = (id) => document.getElementById(id);
const form = $("resultForm");
const subjectsBox = $("subjects");

/* ---------- helpers ---------- */
function loadStudents() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch (e) { return []; }
}
function saveStudents(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}
function escapeHTML(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}
function gradeFor(pct) {
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  if (pct >= PASS_MARK) return "E";
  return "F";
}

/* ---------- subject rows ---------- */
function addSubjectRow(name = "", marks = "") {
  const row = document.createElement("div");
  row.className = "subject-row";
  row.innerHTML = `
    <input type="text" class="sub-name" placeholder="Subject name" aria-label="Subject name">
    <input type="number" class="sub-marks" min="0" max="100" step="any" placeholder="Marks" aria-label="Marks">
    <button type="button" class="ghost rm" aria-label="Remove subject">×</button>`;
  row.querySelector(".sub-name").value = name;
  row.querySelector(".sub-marks").value = marks;
  row.querySelector(".rm").addEventListener("click", () => {
    if (subjectsBox.children.length > 1) row.remove();
  });
  subjectsBox.appendChild(row);
}
function resetSubjects() {
  subjectsBox.innerHTML = "";
  DEFAULT_SUBJECTS.forEach((s) => addSubjectRow(s));
}
$("addSubject").addEventListener("click", () => addSubjectRow());

/* ---------- validation ---------- */
function setError(id, msg) {
  const input = $(id), out = $("err-" + id);
  if (out) out.textContent = msg;
  if (input) input.classList.toggle("invalid", !!msg);
}
function clearErrors() {
  ["studentName", "rollNumber", "course"].forEach((id) => setError(id, ""));
  $("err-subjects").textContent = "";
  subjectsBox.querySelectorAll("input").forEach((i) => i.classList.remove("invalid"));
}

function validate() {
  clearErrors();
  let ok = true;

  const name = $("studentName").value.trim();
  const roll = $("rollNumber").value.trim();
  const course = $("course").value.trim();

  if (name.length < 2) { setError("studentName", "Enter the student's full name."); ok = false; }
  else if (!/^[A-Za-z .'-]+$/.test(name)) { setError("studentName", "Use letters, spaces, . ' or - only."); ok = false; }

  if (!roll) { setError("rollNumber", "Enter a roll number."); ok = false; }
  else if (!/^[A-Za-z0-9-]+$/.test(roll)) { setError("rollNumber", "Use letters, digits or - only."); ok = false; }
  else if (loadStudents().some((s) => s.rollNumber.toLowerCase() === roll.toLowerCase())) {
    setError("rollNumber", "This roll number is already registered."); ok = false;
  }

  if (!course) { setError("course", "Enter the course name."); ok = false; }

  const subjects = [];
  const seen = new Set();
  subjectsBox.querySelectorAll(".subject-row").forEach((row) => {
    const nameEl = row.querySelector(".sub-name");
    const marksEl = row.querySelector(".sub-marks");
    const sName = nameEl.value.trim();
    const raw = marksEl.value;
    const marks = Number(raw);
    let rowOk = true;

    if (!sName) { nameEl.classList.add("invalid"); rowOk = false; }
    else if (seen.has(sName.toLowerCase())) { nameEl.classList.add("invalid"); rowOk = false; }
    seen.add(sName.toLowerCase());

    if (raw === "" || Number.isNaN(marks) || marks < 0 || marks > 100) {
      marksEl.classList.add("invalid"); rowOk = false;
    }
    if (rowOk) subjects.push({ name: sName, marks });
    else ok = false;
  });
  if (subjects.length === 0 || subjects.length !== subjectsBox.children.length) {
    $("err-subjects").textContent =
      "Each subject needs a unique name and marks between 0 and 100.";
    ok = false;
  }

  return ok ? { name, roll, course, subjects } : null;
}

/* ---------- calculate ---------- */
function buildStudent({ name, roll, course, subjects }) {
  const totalMarks = subjects.reduce((sum, s) => sum + s.marks, 0);
  const percentage = totalMarks / subjects.length;
  const withStatus = subjects.map((s) => ({
    ...s,
    grade: gradeFor(s.marks),
    status: s.marks >= PASS_MARK ? "Pass" : "Fail"
  }));
  return {
    id: Date.now(),
    studentName: name,
    rollNumber: roll,
    course,
    subjects: withStatus,
    totalMarks,
    maxMarks: subjects.length * 100,
    percentage: percentage.toFixed(2),
    grade: gradeFor(percentage),
    result: withStatus.every((s) => s.status === "Pass") ? "Pass" : "Fail",
    savedAt: new Date().toISOString()
  };
}

/* ---------- render ---------- */
function showResult(st) {
  $("showName").textContent = st.studentName;
  $("showRoll").textContent = st.rollNumber;
  $("showCourse").textContent = st.course;
  $("showTotal").textContent = `${st.totalMarks} / ${st.maxMarks}`;
  $("showPercentage").textContent = st.percentage + "%";
  $("showGrade").textContent = st.grade;

  const stamp = $("stamp");
  stamp.className = "stamp " + st.result.toLowerCase();
  stamp.textContent = st.result.toUpperCase();

  const body = $("showSubjects");
  body.innerHTML = "";
  st.subjects.forEach((s) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${escapeHTML(s.name)}</td><td>${s.marks}</td><td>${s.grade}</td>
      <td class="${s.status.toLowerCase()}">${s.status}</td>`;
    body.appendChild(tr);
  });

  $("report").hidden = false;
  $("report").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function displaySavedStudents() {
  const all = loadStudents();
  const q = $("search").value.trim().toLowerCase();
  const list = all.filter((s) =>
    s.studentName.toLowerCase().includes(q) || s.rollNumber.toLowerCase().includes(q));
  const box = $("savedStudents");

  const passed = all.filter((s) => s.result === "Pass").length;
  $("stats").textContent = all.length
    ? `${all.length} saved · ${passed} passed · ${all.length - passed} failed`
    : "";

  if (all.length === 0) {
    box.innerHTML = '<p class="empty">No students saved yet. Fill in the form above to add the first one.</p>';
    return;
  }
  if (list.length === 0) {
    box.innerHTML = '<p class="empty">No students match your search.</p>';
    return;
  }

  box.innerHTML = "";
  list.forEach((s) => {
    const item = document.createElement("div");
    item.className = "saved-item " + s.result.toLowerCase();
    item.innerHTML = `
      <div>
        <p><b>${escapeHTML(s.studentName)}</b></p>
        <p class="meta">Roll ${escapeHTML(s.rollNumber)} · ${escapeHTML(s.course)}</p>
        <p class="meta">${s.percentage}% · Grade ${s.grade} · ${s.result}</p>
      </div>
      <div class="item-actions">
        <button type="button" class="ghost" data-view="${s.id}">View</button>
        <button type="button" class="danger" data-del="${s.id}">Delete</button>
      </div>`;
    box.appendChild(item);
  });
}

/* ---------- events ---------- */
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const data = validate();
  if (!data) return;

  const student = buildStudent(data);          // JS object
  const json = JSON.stringify(student);        // converted to JSON
  console.log("Student object:", student);
  console.log("JSON string:", json);

  const students = loadStudents();
  students.push(JSON.parse(json));
  saveStudents(students);                      // stored in Local Storage

  showResult(student);
  displaySavedStudents();
  form.reset();
  resetSubjects();
  clearErrors();
});

form.addEventListener("reset", () => {
  setTimeout(() => { resetSubjects(); clearErrors(); }, 0);
});

$("savedStudents").addEventListener("click", (e) => {
  const view = e.target.dataset.view, del = e.target.dataset.del;
  if (view) {
    const s = loadStudents().find((x) => String(x.id) === view);
    if (s) showResult(s);
  }
  if (del && confirm("Delete this student record?")) {
    saveStudents(loadStudents().filter((x) => String(x.id) !== del));
    displaySavedStudents();
  }
});

$("search").addEventListener("input", displaySavedStudents);

$("clearBtn").addEventListener("click", () => {
  if (loadStudents().length && confirm("Delete ALL saved students? This cannot be undone.")) {
    localStorage.removeItem(STORAGE_KEY);
    $("report").hidden = true;
    displaySavedStudents();
  }
});

$("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(loadStudents(), null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "students.json";
  a.click();
  URL.revokeObjectURL(a.href);
});

/* ---------- init ---------- */
resetSubjects();
displaySavedStudents();
