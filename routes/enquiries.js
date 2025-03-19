const express = require("express");
const upload = require("../config/multer");
const router = express.Router();

// Handle form submission
router.post("/institutions", upload, (req, res) => {
  const {
    fullName,
    collegeName,
    serviceType,
    course,
    email,
    phone,
    description,
  } = req.body;

  if (
    !fullName ||
    !collegeName ||
    !course ||
    !email ||
    !phone ||
    !serviceType
  ) {
    return res
      .status(400)
      .json({ error: "All fields except description are required" });
  }

  const query = `
    INSERT INTO enquiries_institutions (full_name, college_name, course, email, phone, service_type, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  req.con.query(
    query,
    [fullName, collegeName, course, email, phone, serviceType, description],
    (err, result) => {
      if (err) {
        console.error("Error inserting data:", err);
        return res.status(500).json({ error: "Database error" });
      }
      res.status(201).json({
        message: "Enquiry submitted successfully",
        id: result.insertId,
      });
    }
  );
});

// Fetch all enquiries
router.get("/institutions", (req, res) => {
  const query =
    "SELECT * FROM enquiries_institutions ORDER BY submitted_at DESC";

  req.con.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching enquiries:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

module.exports = router;
