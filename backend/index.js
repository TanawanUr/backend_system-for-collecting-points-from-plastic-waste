const express = require("express");
const bodyParser = require("body-parser");
const { Pool } = require("pg");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const path = require("path");

const app = express();
const port = 3000;

const pool = new Pool({
  user: "user",
  host: "db",
  database: "mydb",
  password: "kee1234",
  port: 5432,
});

// Define the folder that will hold your images
const imagesPath = path.join(__dirname, "images");

// Use express.static to serve static files
app.use("/images", express.static(imagesPath));

app.use(bodyParser.json());

app.use(
  cors({
    origin: "*", // อนุญาตให้ทุกโดเมนเข้าถึงได้
    methods: "GET,POST,DELETE",
    credentials: true,
  })
);

// app.post("/login", async (req, res) => {const { e_passport, password } = req.body;
//   try {
//     // Query the database for a user with the provided username, join with Roles table to get role name
//     const result = await pool.query(
//       `SELECT u.user_id, u.password, r.role_name 
//        FROM Users u 
//        JOIN Roles r ON u.role_id = r.role_id 
//        WHERE u.e_passport = $1`,
//       [e_passport]
//     );
//     const user = result.rows[0];

//     // If no user is found, return an error
//     if (!user) {
//       return res.status(400).json({ error: "User not found" });
//     }

//     // Compare the provided password with the hashed password in the database
//     const isMatch = await bcrypt.compare(password, user.password);

//     // If passwords do not match, return an error
//     if (!isMatch) {
//       return res.status(400).json({ error: "Invalid credentials" });
//     }

//     // Create a JWT token with user_id and role_name
//     const token = jwt.sign(
//       { id: user.user_id, role: user.role_name },
//       "your-secret-key"
//       // { expiresIn: "1h" } // Optional expiration
//     );

//     // Send back the token and the user role
//     res.json({ id: user.user_id, token, role: user.role_name });
//   } catch (error) {
//     // Handle any potential errors
//     res.status(500).json({ error: error.message });
//   }
// });


app.post("/saveUser", async (req, res) => {const { e_passport, firstname, lastname, email, token, facname, depname } = req.body;
  const role_id = determineRoleId(req.body);

  try {
    // Check if the user already exists in the database
    const userExists = await pool.query(
      `SELECT user_id FROM users WHERE e_passport = $1`,
      [e_passport]
    );

    if (userExists.rows.length === 0) {
      // Insert new user if they don't exist
      await pool.query(
        `INSERT INTO users (e_passport, firstname, lastname, email, token, facname, depname, role_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [e_passport, firstname, lastname, email, token, facname, depname, role_id]
      );
    } else {
      // Update existing user
      await pool.query(
        `UPDATE users SET token = $1, firstname = $2 , lastname = $3 WHERE e_passport = $4`,
        [token, firstname, lastname, e_passport]
      );
    }

    // Fetch the user's role (assume a 'roles' table or logic that maps role_id to role name)
    const userRole = await pool.query(
      `SELECT r.role_name 
       FROM users u 
       JOIN roles r ON u.role_id = r.role_id 
       WHERE u.e_passport = $1`,
      [e_passport]
    );

    if (userRole.rows.length > 0) {
      const role = userRole.rows[0].role_name;

      // Send back user information, including their role
      res.status(200).json({
        e_passport,
        firstname,
        lastname,
        email,
        token,
        facname,
        depname,
        role,
      });
    } else {
      res.status(404).json({ error: "Role not found" });
    }
  } catch (error) {
    console.error("Error saving user:", error);
    res.status(500).json({ error: error.message });
  }
});

function determineRoleId(userData) {
  if (userData.e_passport.startsWith("admin")) return 1;
  if (userData.e_passport.startsWith("staff")) return 2;
  if (userData.e_passport.startsWith("teacher")) return 3;
  return 4;
}

app.get("/api/user/:ePassport", async (req, res) => {
  const ePassport = req.params.ePassport;
  try {
    const result = await pool.query(
      `SELECT user_id FROM users WHERE e_passport = $1`,
      [ePassport]
    );

    if (result.rows.length > 0) {
      res.json({ user_id: result.rows[0].user_id });
    } else {
      res.status(404).json({ error: "User not found" });
    }
  } catch (error) {
    console.error("Error fetching user ID", error);
    res.status(500).json({ error: "Database error" });
  }
});

// Get Reward History for User
app.get("/api/reward-history/:userId", async (req, res) => {
  const userId = req.params.userId;
  try {
    const result = await pool.query(
      `SELECT rr.request_id, r.reward_type, r.reward_name, rr.requested_at, rr.reviewed_at, 
              rr.status, r.points_required, r.reward_id , rr.reason
       FROM reward_requests rr
       JOIN rewards r ON rr.reward_id = r.reward_id
       WHERE rr.user_id = $1 ORDER BY rr.requested_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching reward history", error);
    res.status(500).json({ error: "Database error" });
  }
});

// app.get("/api/rewards", async (req, res) => {
//   try {
//     const result = await pool.query(`
//       SELECT reward_id, reward_type, reward_name, reward_quantity, points_required
//       FROM rewards
//       ORDER BY reward_id ASC
//     `);
//     res.json(result.rows);
//   } catch (error) {
//     console.error("Error fetching rewards:", error);
//     res.status(500).json({ error: "Database error" });
//   }
// });

app.get("/api/rewards/stationery", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT reward_id, reward_name, reward_quantity, points_required 
       FROM rewards 
       WHERE reward_type = 'stationery'`
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error("❌ Error fetching certificates:", error);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/rewards/certificates", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT reward_id, reward_name, reward_quantity, points_required 
       FROM rewards 
       WHERE reward_type = 'certificate'`
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error("❌ Error fetching certificates:", error);
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/request-reward", async (req, res) => {
  const { user_id, reward_id } = req.body; // Student ID & Reward ID from request

  try {
    // Get the required points & quantity for the reward
    const rewardQuery = await pool.query(
      `SELECT points_required, reward_quantity FROM rewards WHERE reward_id = $1`,
      [reward_id]
    );

    if (rewardQuery.rows.length === 0) {
      return res.status(404).json({ error: "Reward not found" });
    }

    const { points_required, reward_quantity } = rewardQuery.rows[0];

    // Check if there is enough stock
    if (reward_quantity <= 0) {
      return res.status(400).json({ error: "Reward is out of stock" });
    }

    // Get student’s available points
    const studentQuery = await pool.query(
      `SELECT total_points FROM reward_points WHERE user_id = $1`,
      [user_id]
    );

    if (studentQuery.rows.length === 0 || studentQuery.rows[0].total_points < points_required) {
      return res.status(400).json({ error: "Insufficient points" });
    }

    // Deduct reward points from user immediately
    await pool.query(
      `UPDATE reward_points SET total_points = total_points - $1 WHERE user_id = $2`,
      [points_required, user_id]
    );

    // Insert request into reward_requests table (waiting for approval)
    await pool.query(
      `INSERT INTO reward_requests (user_id, reward_id, status, deducted_points) VALUES ($1, $2, 'กำลังรออนุมัติ', $3)`,
      [user_id, reward_id, points_required]
    );

    res.status(201).json({ message: "Reward request submitted successfully, points deducted" });
  } catch (error) {
    console.error("Error requesting reward:", error);
    res.status(500).json({ error: "Database error" });
  }
});


app.post("/api/approve-reward", async (req, res) => {
  const { request_id, approved_by, approval_status, reason } = req.body;

  try {
    // Get request details
    const requestQuery = await pool.query(
      `SELECT user_id, reward_id, deducted_points FROM reward_requests WHERE request_id = $1`,
      [request_id]
    );

    if (requestQuery.rows.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }

    const { user_id, reward_id, deducted_points } = requestQuery.rows[0];

    if (approval_status === "อนุมัติ") {
      // Get required points and reward quantity
      const rewardQuery = await pool.query(
        `SELECT reward_quantity FROM rewards WHERE reward_id = $1`,
        [reward_id]
      );

      if (rewardQuery.rows.length === 0) {
        return res.status(404).json({ error: "Reward not found" });
      }

      const { reward_quantity } = rewardQuery.rows[0];

      // Check if reward is still available
      if (reward_quantity <= 0) {
        return res.status(400).json({ error: "Reward is out of stock" });
      }

      // Decrease reward quantity
      await pool.query(
        `UPDATE rewards SET reward_quantity = reward_quantity - 1 WHERE reward_id = $1`,
        [reward_id]
      );

      // Update request status to approved and store the reason
      await pool.query(
        `UPDATE reward_requests SET status = 'อนุมัติ', reviewed_at = NOW(), reason = $1 WHERE request_id = $2`,
        [reason, request_id]
      );

      // Log approval action
      await pool.query(
        `INSERT INTO reward_approval (request_id, approved_by, approval_status, reason) VALUES ($1, $2, 'อนุมัติ', $3)`,
        [request_id, approved_by, reason]
      );

      return res.status(200).json({ message: "Reward request approved successfully" });
    } else {
      // If rejected, refund the points back to the student
      await pool.query(
        `UPDATE reward_points SET total_points = total_points + $1 WHERE user_id = $2`,
        [deducted_points, user_id]
      );

      // Update request status to rejected and store the reason
      await pool.query(
        `UPDATE reward_requests SET status = 'ยกเลิก', reviewed_at = NOW(), reason = $1 WHERE request_id = $2`,
        [reason, request_id]
      );

      // Log rejection
      await pool.query(
        `INSERT INTO reward_approval (request_id, approved_by, approval_status, reason) VALUES ($1, $2, 'ปฏิเสธ', $3)`,
        [request_id, approved_by, reason]
      );

      return res.status(200).json({ message: "Reward request rejected, points refunded" });
    }
  } catch (error) {
    console.error("Error approving request:", error);
    res.status(500).json({ error: "Database error" });
  }
});



app.get('/users/:e_passport', async (req, res) => {
  try {
    const { e_passport } = req.params;

    const query = `
      SELECT u.user_id,u.e_passport, u.firstname, u.lastname, u.email, u.facname, u.depname, r.role_name, 
             COALESCE(rp.total_points, 0) AS total_points,
             rp.point_expire  -- Fetch point expiration date
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.role_id
      LEFT JOIN reward_points rp ON u.user_id = rp.user_id
      WHERE u.e_passport = $1;
    `;

    const result = await pool.query(query, [e_passport]);

    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// Admin
// app.post("/change-role",authenticateJWT,authorizeRoles("admin"),async (req, res) => {
//     const { userId, newRole } = req.body;

//     try {
//       const user = await User.findByPk(userId);
//       if (!user) {
//         return res.status(404).json({ message: "User not found" });
//       }

//       user.role = newRole;
//       await user.save();
//       res.json({ message: "Role updated successfully", user });
//     } catch (error) {
//       res.status(500).json({ error: "Error updating user role" });
//     }
//   }
// );

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

