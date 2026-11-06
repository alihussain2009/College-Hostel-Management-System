const API = "/api";

document.addEventListener("DOMContentLoaded", () => {

    // Display current date and year
    const dateElement = document.getElementById("todayDate");
    const yearElement = document.getElementById("yearNow");

    if (dateElement) {
        dateElement.textContent = new Date().toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
    }

    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }

    // Identify current page
    const page = document.body.dataset.page;

    if (page === "dashboard") {
        loadDashboard();
    }

    if (page === "students") {
        setupStudents();
    }

    if (page === "rooms") {
        setupRooms();
    }

    if (page === "allocations") {
        setupAllocations();
    }

});


// Common function to communicate with backend
async function apiRequest(path, options = {}) {

    const config = {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    };

    let response;

    try {
        response = await fetch(API + path, config);
    } catch (error) {
        throw new Error("Cannot connect to server. Please run app.js.");
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.message || "Something went wrong.");
    }

    return data;
}


// Display messages
function showMessage(id, message, isError = false) {

    const element = document.getElementById(id);

    if (!element) return;

    element.textContent = message;
    element.classList.toggle("error", isError);

}


// Prevent HTML injection in displayed data
function escapeHTML(value) {

    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);

}


// Format dates
function displayDate(value) {

    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return escapeHTML(value);
    }

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });

}


// Status label
function statusBadge(status) {

    const value = String(status || "").toLowerCase();

    let className = "partial";

    if (value === "active" || value === "available") {
        className = value;
    }

    if (value === "full" || value === "vacated") {
        className = value;
    }

    return `<span class="status ${className}">
        ${escapeHTML(status || "Unknown")}
    </span>`;

}


/* =========================
   DASHBOARD
========================= */

async function loadDashboard() {

    try {

        const data = await apiRequest("/dashboard");

        document.getElementById("totalStudents").textContent =
            data.totalStudents ?? 0;

        document.getElementById("totalRooms").textContent =
            data.totalRooms ?? 0;

        document.getElementById("occupiedBeds").textContent =
            data.occupiedBeds ?? 0;

        document.getElementById("availableBeds").textContent =
            data.availableBeds ?? 0;

        const rows = data.recentAllocations || [];

        document.getElementById("recentAllocations").innerHTML =
            rows.length ? rows.map(item => `
                <tr>
                    <td><strong>${escapeHTML(item.student_name)}</strong></td>
                    <td>${escapeHTML(item.room_number)}</td>
                    <td>${displayDate(item.allocation_date)}</td>
                    <td>${statusBadge(item.status)}</td>
                </tr>
            `).join("") : `
                <tr>
                    <td colspan="4" class="empty-cell">
                        No allocations found yet.
                    </td>
                </tr>
            `;

    } catch (error) {

        document.getElementById("recentAllocations").innerHTML = `
            <tr>
                <td colspan="4" class="empty-cell">
                    ${escapeHTML(error.message)}
                </td>
            </tr>
        `;

    }

}


/* =========================
   STUDENT MANAGEMENT
========================= */

let studentsCache = [];


async function setupStudents() {

    document.getElementById("studentForm")
        .addEventListener("submit", saveStudent);

    document.getElementById("studentCancelBtn")
        .addEventListener("click", resetStudentForm);

    document.getElementById("studentSearch")
        .addEventListener("input", renderStudents);

    await loadStudents();

}


async function loadStudents() {

    try {

        const data = await apiRequest("/students");

        studentsCache = Array.isArray(data)
            ? data
            : data.students || [];

        renderStudents();

    } catch (error) {

        document.getElementById("studentsTable").innerHTML = `
            <tr>
                <td colspan="7" class="empty-cell">
                    ${escapeHTML(error.message)}
                </td>
            </tr>
        `;

    }

}


function renderStudents() {

    const query = document.getElementById("studentSearch")
        .value.trim().toLowerCase();

    const filtered = studentsCache.filter(student =>
        [
            student.name,
            student.roll_number,
            student.department,
            student.phone,
            student.gender
        ].some(value =>
            String(value || "").toLowerCase().includes(query)
        )
    );

    document.getElementById("studentCount").textContent =
        `${filtered.length} student record(s)`;

    document.getElementById("studentsTable").innerHTML =
        filtered.length ? filtered.map(student => `
            <tr>
                <td><strong>${escapeHTML(student.name)}</strong></td>
                <td>${escapeHTML(student.roll_number)}</td>
                <td>${escapeHTML(student.department)}</td>
                <td>${escapeHTML(student.year)}</td>
                <td>${escapeHTML(student.gender)}</td>
                <td>${escapeHTML(student.phone)}</td>
                <td>
                    <button class="action-btn"
                        data-edit-student="${student.student_id}">
                        Edit
                    </button>

                    <button class="action-btn delete"
                        data-delete-student="${student.student_id}">
                        Delete
                    </button>
                </td>
            </tr>
        `).join("") : `
            <tr>
                <td colspan="7" class="empty-cell">
                    No students found.
                </td>
            </tr>
        `;

    document.querySelectorAll("[data-edit-student]").forEach(button => {
        button.addEventListener("click", () => {
            editStudent(button.dataset.editStudent);
        });
    });

    document.querySelectorAll("[data-delete-student]").forEach(button => {
        button.addEventListener("click", () => {
            deleteStudent(button.dataset.deleteStudent);
        });
    });

}


async function saveStudent(event) {

    event.preventDefault();

    const id = document.getElementById("studentId").value;

    const student = {
        name: document.getElementById("studentName").value.trim(),
        roll_number: document.getElementById("rollNumber").value.trim(),
        department: document.getElementById("department").value.trim(),
        year: Number(document.getElementById("studentYear").value),
        gender: document.getElementById("gender").value,
        phone: document.getElementById("phone").value.trim()
    };

    try {

        await apiRequest(
            id ? `/students/${id}` : "/students",
            {
                method: id ? "PUT" : "POST",
                body: JSON.stringify(student)
            }
        );

        showMessage(
            "studentMessage",
            id ? "Student updated successfully." : "Student added successfully."
        );

        resetStudentForm(false);

        await loadStudents();

    } catch (error) {

        showMessage("studentMessage", error.message, true);

    }

}


function editStudent(id) {

    const student = studentsCache.find(
        item => String(item.student_id) === String(id)
    );

    if (!student) return;

    document.getElementById("studentId").value = student.student_id;
    document.getElementById("studentName").value = student.name || "";
    document.getElementById("rollNumber").value = student.roll_number || "";
    document.getElementById("department").value = student.department || "";
    document.getElementById("studentYear").value = student.year || "";
    document.getElementById("gender").value = student.gender || "";
    document.getElementById("phone").value = student.phone || "";

    document.getElementById("studentFormTitle").textContent =
        "Update Student";

    document.getElementById("studentSubmitBtn").textContent =
        "Save Changes";

    document.getElementById("studentCancelBtn")
        .classList.remove("hidden");

    document.getElementById("studentForm")
        .scrollIntoView({ behavior: "smooth" });

}


async function deleteStudent(id) {

    if (!confirm("Are you sure you want to delete this student?")) {
        return;
    }

    try {

        await apiRequest(`/students/${id}`, {
            method: "DELETE"
        });

        await loadStudents();

    } catch (error) {

        alert(error.message);

    }

}


function resetStudentForm(clearMessage = true) {

    document.getElementById("studentForm").reset();

    document.getElementById("studentId").value = "";

    document.getElementById("studentFormTitle").textContent =
        "Add New Student";

    document.getElementById("studentSubmitBtn").textContent =
        "+ Add Student";

    document.getElementById("studentCancelBtn")
        .classList.add("hidden");

    if (clearMessage) {
        showMessage("studentMessage", "");
    }

}


/* =========================
   ROOM MANAGEMENT
========================= */

let roomsCache = [];


async function setupRooms() {

    document.getElementById("roomForm")
        .addEventListener("submit", saveRoom);

    document.getElementById("roomCancelBtn")
        .addEventListener("click", resetRoomForm);

    document.getElementById("roomSearch")
        .addEventListener("input", renderRooms);

    await loadRooms();

}


async function loadRooms() {

    try {

        const data = await apiRequest("/rooms");

        roomsCache = Array.isArray(data)
            ? data
            : data.rooms || [];

        renderRooms();

    } catch (error) {

        document.getElementById("roomsTable").innerHTML = `
            <tr>
                <td colspan="8" class="empty-cell">
                    ${escapeHTML(error.message)}
                </td>
            </tr>
        `;

    }

}


function renderRooms() {

    const query = document.getElementById("roomSearch")
        .value.trim().toLowerCase();

    const filtered = roomsCache.filter(room =>
        [
            room.room_number,
            room.block_name,
            room.room_type
        ].some(value =>
            String(value || "").toLowerCase().includes(query)
        )
    );

    document.getElementById("roomCount").textContent =
        `${filtered.length} room record(s)`;

    document.getElementById("roomsTable").innerHTML =
        filtered.length ? filtered.map(room => {

            const occupied = Number(
                room.occupied ?? room.occupied_beds ?? 0
            );

            const capacity = Number(room.capacity || 0);

            const available = Math.max(0, capacity - occupied);

            const status = available === 0
                ? "Full"
                : occupied === 0
                    ? "Available"
                    : "Partial";

            return `
                <tr>
                    <td><strong>${escapeHTML(room.room_number)}</strong></td>
                    <td>${escapeHTML(room.block_name)}</td>
                    <td>${escapeHTML(room.room_type)}</td>
                    <td>${capacity}</td>
                    <td>${occupied}</td>
                    <td>${available}</td>
                    <td>${statusBadge(status)}</td>
                    <td>
                        <button class="action-btn"
                            data-edit-room="${room.room_id}">
                            Edit
                        </button>

                        <button class="action-btn delete"
                            data-delete-room="${room.room_id}">
                            Delete
                        </button>
                    </td>
                </tr>
            `;

        }).join("") : `
            <tr>
                <td colspan="8" class="empty-cell">
                    No rooms found.
                </td>
            </tr>
        `;

    document.querySelectorAll("[data-edit-room]").forEach(button => {
        button.addEventListener("click", () => {
            editRoom(button.dataset.editRoom);
        });
    });

    document.querySelectorAll("[data-delete-room]").forEach(button => {
        button.addEventListener("click", () => {
            deleteRoom(button.dataset.deleteRoom);
        });
    });

}


async function saveRoom(event) {

    event.preventDefault();

    const id = document.getElementById("roomId").value;

    const room = {
        room_number: document.getElementById("roomNumber").value.trim(),
        block_name: document.getElementById("blockName").value.trim(),
        room_type: document.getElementById("roomType").value,
        capacity: Number(document.getElementById("capacity").value)
    };

    try {

        await apiRequest(
            id ? `/rooms/${id}` : "/rooms",
            {
                method: id ? "PUT" : "POST",
                body: JSON.stringify(room)
            }
        );

        showMessage(
            "roomMessage",
            id ? "Room updated successfully." : "Room added successfully."
        );

        resetRoomForm(false);

        await loadRooms();

    } catch (error) {

        showMessage("roomMessage", error.message, true);

    }

}


function editRoom(id) {

    const room = roomsCache.find(
        item => String(item.room_id) === String(id)
    );

    if (!room) return;

    document.getElementById("roomId").value = room.room_id;
    document.getElementById("roomNumber").value = room.room_number || "";
    document.getElementById("blockName").value = room.block_name || "";
    document.getElementById("roomType").value = room.room_type || "";
    document.getElementById("capacity").value = room.capacity || "";

    document.getElementById("roomFormTitle").textContent =
        "Update Room";

    document.getElementById("roomSubmitBtn").textContent =
        "Save Changes";

    document.getElementById("roomCancelBtn")
        .classList.remove("hidden");

    document.getElementById("roomForm")
        .scrollIntoView({ behavior: "smooth" });

}


async function deleteRoom(id) {

    if (!confirm("Are you sure you want to delete this room?")) {
        return;
    }

    try {

        await apiRequest(`/rooms/${id}`, {
            method: "DELETE"
        });

        await loadRooms();

    } catch (error) {

        alert(error.message);

    }

}


function resetRoomForm(clearMessage = true) {

    document.getElementById("roomForm").reset();

    document.getElementById("roomId").value = "";

    document.getElementById("roomFormTitle").textContent =
        "Add New Room";

    document.getElementById("roomSubmitBtn").textContent =
        "+ Add Room";

    document.getElementById("roomCancelBtn")
        .classList.add("hidden");

    if (clearMessage) {
        showMessage("roomMessage", "");
    }

}


/* =========================
   ROOM ALLOCATION
========================= */

let allocationsCache = [];


async function setupAllocations() {

    document.getElementById("allocationForm")
        .addEventListener("submit", saveAllocation);

    document.getElementById("allocationSearch")
        .addEventListener("input", renderAllocations);

    document.getElementById("allocationDate").value =
        new Date().toISOString().slice(0, 10);

    await Promise.all([
        loadAllocationOptions(),
        loadAllocations()
    ]);

}


async function loadAllocationOptions() {

    try {

        const [studentsData, roomsData] = await Promise.all([
            apiRequest("/students"),
            apiRequest("/rooms")
        ]);

        const students = Array.isArray(studentsData)
            ? studentsData
            : studentsData.students || [];

        const rooms = Array.isArray(roomsData)
            ? roomsData
            : roomsData.rooms || [];

        document.getElementById("allocationStudent").innerHTML =
            '<option value="">Select student</option>' +
            students.map(student => `
                <option value="${student.student_id}">
                    ${escapeHTML(student.name)}
                    (${escapeHTML(student.roll_number)})
                </option>
            `).join("");

        const availableRooms = rooms.filter(room =>
            Number(room.capacity) >
            Number(room.occupied ?? room.occupied_beds ?? 0)
        );

        document.getElementById("allocationRoom").innerHTML =
            '<option value="">Select available room</option>' +
            availableRooms.map(room => {

                const freeBeds = Number(room.capacity) -
                    Number(room.occupied ?? room.occupied_beds ?? 0);

                return `
                    <option value="${room.room_id}">
                        ${escapeHTML(room.room_number)}
                        - ${escapeHTML(room.block_name)}
                        (${freeBeds} beds available)
                    </option>
                `;

            }).join("");

    } catch (error) {

        showMessage("allocationMessage", error.message, true);

    }

}


async function loadAllocations() {

    try {

        const data = await apiRequest("/allocations");

        allocationsCache = Array.isArray(data)
            ? data
            : data.allocations || [];

        renderAllocations();

    } catch (error) {

        document.getElementById("allocationsTable").innerHTML = `
            <tr>
                <td colspan="7" class="empty-cell">
                    ${escapeHTML(error.message)}
                </td>
            </tr>
        `;

    }

}


function renderAllocations() {

    const query = document.getElementById("allocationSearch")
        .value.trim().toLowerCase();

    const filtered = allocationsCache.filter(allocation =>
        [
            allocation.student_name,
            allocation.roll_number,
            allocation.room_number,
            allocation.block_name
        ].some(value =>
            String(value || "").toLowerCase().includes(query)
        )
    );

    document.getElementById("allocationCount").textContent =
        `${filtered.length} allocation record(s)`;

    document.getElementById("allocationsTable").innerHTML =
        filtered.length ? filtered.map(allocation => `

            <tr>
                <td><strong>${escapeHTML(allocation.student_name)}</strong></td>
                <td>${escapeHTML(allocation.roll_number)}</td>
                <td>${escapeHTML(allocation.room_number)}</td>
                <td>${escapeHTML(allocation.block_name)}</td>
                <td>${displayDate(allocation.allocation_date)}</td>
                <td>${statusBadge(allocation.status)}</td>

                <td>
                    ${
                        String(allocation.status).toLowerCase() === "active"
                        ? `<button class="action-btn delete"
                            data-vacate="${allocation.allocation_id}">
                            Vacate
                           </button>`
                        : "—"
                    }
                </td>
            </tr>

        `).join("") : `
            <tr>
                <td colspan="7" class="empty-cell">
                    No allocation records found.
                </td>
            </tr>
        `;

    document.querySelectorAll("[data-vacate]").forEach(button => {

        button.addEventListener("click", () => {
            vacateAllocation(button.dataset.vacate);
        });

    });

}


async function saveAllocation(event) {

    event.preventDefault();

    const allocation = {
        student_id: Number(
            document.getElementById("allocationStudent").value
        ),

        room_id: Number(
            document.getElementById("allocationRoom").value
        ),

        allocation_date:
            document.getElementById("allocationDate").value
    };

    try {

        await apiRequest("/allocations", {
            method: "POST",
            body: JSON.stringify(allocation)
        });

        showMessage(
            "allocationMessage",
            "Room allocated successfully."
        );

        document.getElementById("allocationForm").reset();

        document.getElementById("allocationDate").value =
            new Date().toISOString().slice(0, 10);

        await Promise.all([
            loadAllocationOptions(),
            loadAllocations()
        ]);

    } catch (error) {

        showMessage("allocationMessage", error.message, true);

    }

}


async function vacateAllocation(id) {

    if (!confirm("Are you sure you want to vacate this allocation?")) {
        return;
    }

    try {

        await apiRequest(`/allocations/${id}/vacate`, {
            method: "PUT"
        });

        await Promise.all([
            loadAllocationOptions(),
            loadAllocations()
        ]);

    } catch (error) {

        alert(error.message);

    }

}