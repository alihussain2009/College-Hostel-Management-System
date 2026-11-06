
const express = require("express");
const mysql = require("mysql2/promise");

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static("public"));

// MySQL database connection
const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "Ali@2006!Aze3Z",
    database: "hostel_management",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Helper function for errors
function handleError(res, error) {
    console.error(error);

    if (error.code === "ER_DUP_ENTRY") {
        return res.status(400).json({
            message: "This record already exists. Please check the entered details."
        });
    }

    if (error.code === "ER_ROW_IS_REFERENCED_2") {
        return res.status(400).json({
            message: "This record cannot be deleted because it is linked to an allocation."
        });
    }

    res.status(500).json({
        message: "Something went wrong. Please try again."
    });
}

// Validate student and room input
function validateStudent(data) {
    const { name, roll_number, department, year, gender, phone } = data;

    if (!name || !roll_number || !department || !year || !gender || !phone) {
        return "Please fill in all student details.";
    }

    if (!Number.isInteger(Number(year)) || Number(year) < 1) {
        return "Please enter a valid academic year.";
    }

    return null;
}

function validateRoom(data) {
    const { room_number, block_name, room_type, capacity } = data;

    if (!room_number || !block_name || !room_type || !capacity) {
        return "Please fill in all room details.";
    }

    if (!Number.isInteger(Number(capacity)) || Number(capacity) < 1) {
        return "Room capacity must be a positive number.";
    }

    return null;
}

// --------------------------------------------------
// DASHBOARD
// --------------------------------------------------

app.get("/api/dashboard", async (req, res) => {
    try {
        const [studentResult] = await db.execute(
            "SELECT COUNT(*) AS totalStudents FROM students"
        );

        const [roomResult] = await db.execute(
            "SELECT COUNT(*) AS totalRooms FROM rooms"
        );

        const [allocationResult] = await db.execute(
            `SELECT COUNT(*) AS occupiedBeds
             FROM allocation
             WHERE status = 'Active'`
        );

        const [capacityResult] = await db.execute(
            "SELECT COALESCE(SUM(capacity), 0) AS totalBeds FROM rooms"
        );

        const totalStudents = studentResult[0].totalStudents;
        const totalRooms = roomResult[0].totalRooms;
        const occupiedBeds = allocationResult[0].occupiedBeds;
        const totalBeds = capacityResult[0].totalBeds;
        const availableBeds = totalBeds - occupiedBeds;

        const [recentAllocations] = await db.execute(
            `SELECT
                s.name AS student_name,
                r.room_number,
                a.allocation_date,
                a.status
             FROM allocation a
             JOIN students s ON a.student_id = s.student_id
             JOIN rooms r ON a.room_id = r.room_id
             ORDER BY a.allocation_id DESC
             LIMIT 5`
        );

        res.json({
            totalStudents,
            totalRooms,
            occupiedBeds,
            availableBeds,
            recentAllocations
        });

    } catch (error) {
        handleError(res, error);
    }
});

// --------------------------------------------------
// STUDENTS
// --------------------------------------------------

// Get all students
app.get("/api/students", async (req, res) => {
    try {
        const [rows] = await db.execute(
            "SELECT * FROM students ORDER BY student_id DESC"
        );

        res.json(rows);

    } catch (error) {
        handleError(res, error);
    }
});

// Add student
app.post("/api/students", async (req, res) => {
    try {
        const errorMessage = validateStudent(req.body);

        if (errorMessage) {
            return res.status(400).json({ message: errorMessage });
        }

        const { name, roll_number, department, year, gender, phone } = req.body;

        await db.execute(
            `INSERT INTO students
             (name, roll_number, department, year, gender, phone)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [name, roll_number, department, year, gender, phone]
        );

        res.status(201).json({
            message: "Student added successfully."
        });

    } catch (error) {
        handleError(res, error);
    }
});

// Update student
app.put("/api/students/:id", async (req, res) => {
    try {
        const errorMessage = validateStudent(req.body);

        if (errorMessage) {
            return res.status(400).json({ message: errorMessage });
        }

        const { name, roll_number, department, year, gender, phone } = req.body;

        const [result] = await db.execute(
            `UPDATE students
             SET name = ?, roll_number = ?, department = ?,
                 year = ?, gender = ?, phone = ?
             WHERE student_id = ?`,
            [name, roll_number, department, year, gender, phone, req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Student not found."
            });
        }

        res.json({
            message: "Student updated successfully."
        });

    } catch (error) {
        handleError(res, error);
    }
});

// Delete student
app.delete("/api/students/:id", async (req, res) => {
    try {
        const [result] = await db.execute(
            "DELETE FROM students WHERE student_id = ?",
            [req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Student not found."
            });
        }

        res.json({
            message: "Student deleted successfully."
        });

    } catch (error) {
        handleError(res, error);
    }
});

// --------------------------------------------------
// ROOMS
// --------------------------------------------------

// Get all rooms with occupancy
app.get("/api/rooms", async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT
                r.*,
                COUNT(a.allocation_id) AS occupied
             FROM rooms r
             LEFT JOIN allocation a
                ON r.room_id = a.room_id
                AND a.status = 'Active'
             GROUP BY r.room_id
             ORDER BY r.room_id DESC`
        );

        res.json(rows);

    } catch (error) {
        handleError(res, error);
    }
});

// Add room
app.post("/api/rooms", async (req, res) => {
    try {
        const errorMessage = validateRoom(req.body);

        if (errorMessage) {
            return res.status(400).json({ message: errorMessage });
        }

        const { room_number, block_name, room_type, capacity } = req.body;

        await db.execute(
            `INSERT INTO rooms
             (room_number, block_name, room_type, capacity)
             VALUES (?, ?, ?, ?)`,
            [room_number, block_name, room_type, capacity]
        );

        res.status(201).json({
            message: "Room added successfully."
        });

    } catch (error) {
        handleError(res, error);
    }
});

// Update room
app.put("/api/rooms/:id", async (req, res) => {
    try {
        const errorMessage = validateRoom(req.body);

        if (errorMessage) {
            return res.status(400).json({ message: errorMessage });
        }

        const { room_number, block_name, room_type, capacity } = req.body;

        const [occupiedResult] = await db.execute(
            `SELECT COUNT(*) AS occupied
             FROM allocation
             WHERE room_id = ? AND status = 'Active'`,
            [req.params.id]
        );

        if (Number(capacity) < occupiedResult[0].occupied) {
            return res.status(400).json({
                message: "Capacity cannot be less than the number of occupied beds."
            });
        }

        const [result] = await db.execute(
            `UPDATE rooms
             SET room_number = ?, block_name = ?,
                 room_type = ?, capacity = ?
             WHERE room_id = ?`,
            [room_number, block_name, room_type, capacity, req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Room not found."
            });
        }

        res.json({
            message: "Room updated successfully."
        });

    } catch (error) {
        handleError(res, error);
    }
});

// Delete room
app.delete("/api/rooms/:id", async (req, res) => {
    try {
        const [result] = await db.execute(
            "DELETE FROM rooms WHERE room_id = ?",
            [req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Room not found."
            });
        }

        res.json({
            message: "Room deleted successfully."
        });

    } catch (error) {
        handleError(res, error);
    }
});

// --------------------------------------------------
// ALLOCATIONS
// --------------------------------------------------

// Get all allocations
app.get("/api/allocations", async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT
                a.allocation_id,
                s.name AS student_name,
                s.roll_number,
                r.room_number,
                r.block_name,
                a.allocation_date,
                a.status
             FROM allocation a
             JOIN students s ON a.student_id = s.student_id
             JOIN rooms r ON a.room_id = r.room_id
             ORDER BY a.allocation_id DESC`
        );

        res.json(rows);

    } catch (error) {
        handleError(res, error);
    }
});

// Allocate room to student
app.post("/api/allocations", async (req, res) => {
    const connection = await db.getConnection();

    try {
        const { student_id, room_id, allocation_date } = req.body;

        if (!student_id || !room_id || !allocation_date) {
            connection.release();

            return res.status(400).json({
                message: "Please select a student, room and allocation date."
            });
        }

        await connection.beginTransaction();

        // Lock the room while checking available beds
        const [rooms] = await connection.execute(
            "SELECT * FROM rooms WHERE room_id = ? FOR UPDATE",
            [room_id]
        );

        if (rooms.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                message: "Room not found."
            });
        }

        // Check student exists
        const [students] = await connection.execute(
            "SELECT student_id FROM students WHERE student_id = ?",
            [student_id]
        );

        if (students.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                message: "Student not found."
            });
        }

        // Check whether student already has an active room
        const [existing] = await connection.execute(
            `SELECT allocation_id
             FROM allocation
             WHERE student_id = ? AND status = 'Active'`,
            [student_id]
        );

        if (existing.length > 0) {
            await connection.rollback();

            return res.status(400).json({
                message: "This student already has an active room allocation."
            });
        }

        // Check room capacity
        const [occupied] = await connection.execute(
            `SELECT COUNT(*) AS occupied
             FROM allocation
             WHERE room_id = ? AND status = 'Active'`,
            [room_id]
        );

        if (occupied[0].occupied >= rooms[0].capacity) {
            await connection.rollback();

            return res.status(400).json({
                message: "This room is already full. Please select another room."
            });
        }

        // Create allocation
        await connection.execute(
            `INSERT INTO allocation
             (student_id, room_id, allocation_date, status)
             VALUES (?, ?, ?, 'Active')`,
            [student_id, room_id, allocation_date]
        );

        await connection.commit();

        res.status(201).json({
            message: "Room allocated successfully."
        });

    } catch (error) {
        await connection.rollback();
        handleError(res, error);

    } finally {
        connection.release();
    }
});

// Vacate room
app.put("/api/allocations/:id/vacate", async (req, res) => {
    try {
        const [result] = await db.execute(
            `UPDATE allocation
             SET status = 'Vacated'
             WHERE allocation_id = ? AND status = 'Active'`,
            [req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Active allocation not found."
            });
        }

        res.json({
            message: "Room vacated successfully."
        });

    } catch (error) {
        handleError(res, error);
    }
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

async function startServer() {
    try {
        const connection = await db.getConnection();
        console.log("MySQL Database Connected Successfully!");
        connection.release();

        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
        });

    } catch (error) {
        console.error("Database connection failed:", error.message);
    }
}

startServer();
