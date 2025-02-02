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

// app.post("/api/users", async (req, res) => {
//   const { username, password, role } = req.body;
//   try {
//     const result = await pool.query(
//       "INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING *",
//       [username, password, role]
//     );
//     res.json(result.rows[0]);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

app.post("/login", async (req, res) => {const { e_passport, password } = req.body;
  try {
    // Query the database for a user with the provided username, join with Roles table to get role name
    const result = await pool.query(
      `SELECT u.user_id, u.password, r.role_name 
       FROM Users u 
       JOIN Roles r ON u.role_id = r.role_id 
       WHERE u.e_passport = $1`,
      [e_passport]
    );
    const user = result.rows[0];

    // If no user is found, return an error
    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    // Compare the provided password with the hashed password in the database
    const isMatch = await bcrypt.compare(password, user.password);

    // If passwords do not match, return an error
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Create a JWT token with user_id and role_name
    const token = jwt.sign(
      { id: user.user_id, role: user.role_name },
      "your-secret-key"
      // { expiresIn: "1h" } // Optional expiration
    );

    // Send back the token and the user role
    res.json({ id: user.user_id, token, role: user.role_name });
  } catch (error) {
    // Handle any potential errors
    res.status(500).json({ error: error.message });
  }
});


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

// Function to determine the role_id based on user data
function determineRoleId(userData) {
  if (userData.e_passport.startsWith("admin")) return 1; // Admin role
  if (userData.e_passport.startsWith("staff")) return 2; // Manager role
  if (userData.e_passport.startsWith("teacher")) return 3; // Manager role
  return 4; // Default role (e.g., Customer)
}


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

// app.post("/login", async (req, res) => {
//   const { username, password } = req.body;

//   try {
//     // Query the database for a user with the provided username
//     const result = await pool.query("SELECT * FROM users WHERE username = $1", [
//       username,
//     ]);
//     const user = result.rows[0];

//     // If no user is found, return an error
//     if (!user) {
//       return res.status(400).json({ error: "User not found" });
//     }

//     // Compare the provided password with the hashed password in the database
//     const isMatch = await bcrypt.compare(password, user.password);

//     if (!isMatch) {
//         return res.status(400).json({ error: 'Invalid credentials' });
//     }

//     // Create a JWT token with user id and role
//     const token = jwt.sign({ id: user.id, role: user.role }, "your-secret-key");

//     // Send back the token and the user role
//     res.json({ token, role: user.role });
//   } catch (error) {
//     // Handle any potential errors
//     res.status(500).json({ error: error.message });
//   }
// });
