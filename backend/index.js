const express = require("express");
const bodyParser = require("body-parser");
const { Pool } = require("pg");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const WebSocket = require("ws");

const app = express();
const port = 3000;

const pool = new Pool({
  user: "user",
  host: "db",
  database: "mydb",
  password: "kee1234",
  port: 5432,
});

// Configure storage options for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Save images in the 'images' folder
    cb(null, path.join(__dirname, "images"));
  },
  filename: (req, file, cb) => {
    // Create a unique filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

// Create the multer instance
const upload = multer({ storage: storage });

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

const WS_PORT = 8080;

const wss = new WebSocket.Server({ port: WS_PORT }, () => {
  console.log(`WebSocket server listening on ws://localhost:${WS_PORT}`);
});

let espSocket = null;
let flutterSocket = null;
let latestCount = 0;
let latestUserId = "";
const imagePath = path.join(__dirname, "latest_image.jpg");

wss.on("connection", (ws) => {
  console.log("New client connected");

  ws.on("message", async (message) => {
    const data = message.toString();
    console.log("Received:", data);

    // Identify ESP and Flutter
    if (data === "ESP_CONNECTED") {
      espSocket = ws;
      console.log("ESP32 connected");
    } else if (data === "FLUTTER_CONNECTED") {
      flutterSocket = ws;
      if (espSocket) {
        espSocket.send("FLUTTER_CONNECTED");
        console.log("Flutter connected, message sent to ESP");
      } else {
        console.log("ESP not connected, can't send FLUTTER_CONNECTED");
      }
    }

    // Handle messages
    if (data.startsWith("USER_ID:")) {
      if (espSocket) {
        espSocket.send(data);
        latestUserId = data.split(":")[1];
        console.log(`User ID sent to ESP: ${data}`);
      } else {
        console.log("ESP not connected!");
      }
    } else if (data.startsWith("COUNT:")) {
      if (flutterSocket) {
        flutterSocket.send(data);
        point = 1;
        total_points = data.split(":")[1];
        console.log(`Count sent to Flutter: ${data}`);
      } else {
        console.log("Flutter not connected!");
      }
    } else if (data.startsWith("IMAGE:")) {
      const base64Data = data.split(":")[1];
      const imageBuffer = Buffer.from(base64Data, "base64");

      try {
        // Save to the database
        await pool.query(
          "INSERT INTO transactions (user_id, point, total_point, image_base64) VALUES ($1, $2, $3, $4)",
          [latestUserId, point, total_points, base64Data]
        );
        console.log("Transaction saved to DB for User ID:", latestUserId);
      } catch (err) {
        console.error("Error saving to DB:", err);
      }

      // Save the image or upload to the database
      fs.writeFileSync("image.jpg", imageBuffer);
      console.log("Image saved!");
      if (flutterSocket) {
        flutterSocket.send(data);
        console.log("Image sent to Flutter");
      }
    }
  });

  // ws.on("close", () => {
  //   if (ws === espSocket) {
  //     espSocket = null;
  //     console.log("ESP32 disconnected");
  //   }
  //   if (ws === flutterSocket) {
  //     flutterSocket = null;
  //     espSocket.send("FLUTTER_DISCONNECTED");
  //     console.log("Flutter disconnected");
  //   }
  // });

  ws.on("close", async () => {
    if (ws === espSocket) {
      espSocket = null;
      console.log("ESP32 disconnected");
    }
    if (ws === flutterSocket) {
      flutterSocket = null;
      if (latestUserId && total_points) {
        try {
          const { rows } = await pool.query(
            "SELECT setting_value FROM global_settings WHERE setting_name = 'point_expire'"
          );
          const pointExpire = rows[0]?.setting_value;

          await pool.query(
            `INSERT INTO reward_points (user_id, total_points, point_expire) 
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id) 
             DO UPDATE SET total_points = reward_points.total_points + EXCLUDED.total_points, updated_at = NOW()`,
            [latestUserId, total_points, pointExpire]
          );
          console.log(`Total points updated for User ID: ${latestUserId}`);
        } catch (err) {
          console.error("Error updating reward points:", err);
        }
      }
      if (espSocket) espSocket.send("FLUTTER_DISCONNECTED");
      console.log("Flutter disconnected");
    }
  });
});

app.post("/saveUser", async (req, res) => {
  const { e_passport, firstname, lastname, email, token, facname, depname } =
    req.body;
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
        [
          e_passport,
          firstname,
          lastname,
          email,
          token,
          facname,
          depname,
          role_id,
        ]
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
              rr.status, r.points_required, r.reward_image, r.reward_id , rr.reason
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

app.get("/api/user-history/:userId", async (req, res) => {
  const userId = req.params.userId;
  try {
    // Fetch reward history
    const rewardHistory = await pool.query(
      `SELECT rr.request_id, r.reward_type, r.reward_name, rr.requested_at, rr.reviewed_at, 
              rr.status, r.points_required, r.reward_image, r.reward_id , rr.reason
       FROM reward_requests rr
       JOIN rewards r ON rr.reward_id = r.reward_id
       WHERE rr.user_id = $1 ORDER BY rr.requested_at DESC`,
      [userId]
    );

    // Fetch affective scores
    const affectiveScores = await pool.query(
      `SELECT a.score_id, a.score, a.date_recorded, s.subject_name, 
              u.firstname, u.lastname, u.facname, u.depname
       FROM affective_scores a
       JOIN subject s ON a.subject_id = s.subject_id
       JOIN users u ON a.user_id = u.user_id
       WHERE a.user_id = $1
       ORDER BY a.date_recorded DESC`,
      [userId]
    );

    // Combine both responses
    res.json({
      rewardHistory: rewardHistory.rows,
      affectiveScores: affectiveScores.rows,
    });
  } catch (error) {
    console.error("Error fetching user history", error);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/rewards/stationery", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT reward_id, reward_name, reward_quantity, points_required, reward_image
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
      `SELECT reward_id, reward_name, reward_quantity, points_required, reward_image
       FROM rewards 
       WHERE reward_type = 'certificate'`
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error("❌ Error fetching certificates:", error);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/rewards/affectivescore", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT reward_id, reward_name, reward_quantity, points_required
       FROM rewards 
       WHERE reward_type = 'affective_score'`
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

    if (
      studentQuery.rows.length === 0 ||
      studentQuery.rows[0].total_points < points_required
    ) {
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

    res.status(201).json({
      message: "Reward request submitted successfully, points deducted",
    });
  } catch (error) {
    console.error("Error requesting reward:", error);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/users/:e_passport", async (req, res) => {
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
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).json({ error: "Internal Server Error" });
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

/* PROFESSOR */

app.get("/professor/request-list", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
          rr.request_id, 
          u.e_passport, 
          u.firstname, 
          u.lastname, 
          u.facname, 
          u.depname,
          r.reward_type, 
          r.reward_name, 
          rr.requested_at, 
          rr.reviewed_at, 
          rr.status, 
          r.points_required, 
          r.reward_image,
          r.reward_id,
          rr.reason
       FROM reward_requests rr
       JOIN rewards r ON rr.reward_id = r.reward_id
       JOIN users u ON rr.user_id = u.user_id
       WHERE r.reward_type = 'affective_score' AND rr.status = 'กำลังรออนุมัติ'
       ORDER BY rr.requested_at DESC`
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching pending reward requests", error);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/professor/affective-hisotry", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
          rr.request_id, 
          u.e_passport, 
          u.firstname, 
          u.lastname, 
          u.facname, 
          u.depname,
          r.reward_type, 
          r.reward_name, 
          rr.requested_at, 
          rr.reviewed_at, 
          rr.status, 
          r.points_required, 
          r.reward_id,
          rr.reason
       FROM reward_requests rr
       JOIN rewards r ON rr.reward_id = r.reward_id
       JOIN users u ON rr.user_id = u.user_id
       WHERE r.reward_type = 'affective_score' AND rr.status IN ('อนุมัติ', 'ยกเลิก')
       ORDER BY rr.reviewed_at DESC`
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching approved reward requests", error);
    res.status(500).json({ error: "Database error" });
  }
});

/* STAFF */

app.post(
  "/staff/add-reward",
  upload.single("reward_image"),
  async (req, res) => {
    const { reward_type, reward_name, reward_quantity, points_required } =
      req.body;

    if (!reward_name || !reward_quantity || !points_required) {
      return res.status(400).json({ error: "Missing required reward details" });
    }

    const type = reward_type || "stationery";

    try {
      // First, insert the new reward into the database with a temporary NULL for reward_image
      const result = await pool.query(
        `INSERT INTO rewards (reward_type, reward_name, reward_quantity, points_required, reward_image)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING reward_id`,
        [type, reward_name, reward_quantity, points_required, null]
      );
      const reward_id = result.rows[0].reward_id;

      // If a file was uploaded, rename it and update the database
      if (req.file) {
        // Log the uploaded file info for debugging
        console.log("Uploaded file:", req.file);

        // Get the file extension from the original filename
        const extension = path.extname(req.file.originalname);
        // Create the new filename in the format reward_{reward_id}.{extension}
        const newFileName = `reward_${reward_id}${extension}`;
        const oldPath = path.join(imagesPath, req.file.filename);
        const newPath = path.join(imagesPath, newFileName);

        // Rename the file and update the reward_image in the database
        fs.rename(oldPath, newPath, async (err) => {
          if (err) {
            console.error("Error renaming file:", err);
            return res.status(500).json({ error: "File renaming failed" });
          }
          try {
            // Update the reward record with the new image filename
            await pool.query(
              `UPDATE rewards SET reward_image = $1 WHERE reward_id = $2`,
              [newFileName, reward_id]
            );
            res.status(201).json({
              message: "Reward added successfully",
              reward_id: reward_id,
              reward_image: newFileName,
            });
          } catch (updateErr) {
            console.error("Error updating reward with image name:", updateErr);
            res.status(500).json({ error: "Database update failed" });
          }
        });
      } else {
        // No file was uploaded; respond normally.
        res.status(201).json({
          message: "Reward added successfully (no image uploaded)",
          reward_id: reward_id,
          reward_image: null,
        });
      }
    } catch (error) {
      console.error("Error adding reward:", error);
      res.status(500).json({ error: "Database error" });
    }
  }
);

app.put(
  "/staff/edit-reward/:reward_id",
  upload.single("reward_image"),
  async (req, res) => {
    const { reward_id } = req.params;
    const { reward_name, reward_quantity, points_required, reward_type } =
      req.body;

    try {
      // First, update the basic reward details
      await pool.query(
        `UPDATE rewards SET reward_name = $1, reward_quantity = $2, points_required = $3, reward_type = $4 WHERE reward_id = $5`,
        [reward_name, reward_quantity, points_required, reward_type, reward_id]
      );

      // If a new image was uploaded, handle renaming & update reward_image column
      if (req.file) {
        const extension = path.extname(req.file.originalname) || ".jpg";
        const newFileName = `reward_${reward_id}${extension}`;
        const oldPath = path.join(imagesPath, req.file.filename);
        const newPath = path.join(imagesPath, newFileName);

        fs.rename(oldPath, newPath, async (err) => {
          if (err) {
            console.error("Error renaming file:", err);
            return res.status(500).json({ error: "File renaming failed" });
          }
          try {
            await pool.query(
              `UPDATE rewards SET reward_image = $1 WHERE reward_id = $2`,
              [newFileName, reward_id]
            );
            res.status(200).json({ message: "Reward updated successfully" });
          } catch (updateErr) {
            console.error("Error updating reward image:", updateErr);
            res.status(500).json({ error: "Database update failed" });
          }
        });
      } else {
        res.status(200).json({ message: "Reward updated successfully" });
      }
    } catch (error) {
      console.error("Error updating reward:", error);
      res.status(500).json({ error: "Database error" });
    }
  }
);

app.delete("/staff/delete-reward/:reward_id", async (req, res) => {
  const reward_id = req.params.reward_id;

  try {
    // Optionally, get the reward's image filename so you can delete the file from disk
    const result = await pool.query(
      `SELECT reward_image FROM rewards WHERE reward_id = $1`,
      [reward_id]
    );
    const reward = result.rows[0];

    if (!reward) {
      return res.status(404).json({ error: "Reward not found" });
    }

    // Delete the reward from the database
    await pool.query(`DELETE FROM rewards WHERE reward_id = $1`, [reward_id]);

    // Optionally, delete the image file if it exists
    if (reward.reward_image) {
      const filePath = path.join(imagesPath, reward.reward_image);
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error("Error deleting image file:", err);
        }
      });
    }

    res.status(200).json({ message: "Reward deleted successfully" });
  } catch (error) {
    console.error("Error deleting reward:", error);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/staff/reward-approved", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
          rr.request_id, 
          u.e_passport, 
          u.firstname, 
          u.lastname, 
          u.facname, 
          u.depname,
          r.reward_type, 
          r.reward_name, 
          rr.requested_at, 
          rr.reviewed_at, 
          rr.status, 
          r.points_required, 
          r.reward_image,
          r.reward_id,
          rr.reason
       FROM reward_requests rr
       JOIN rewards r ON rr.reward_id = r.reward_id
       JOIN users u ON rr.user_id = u.user_id
       WHERE r.reward_type = 'stationery' AND rr.status IN ('อนุมัติ', 'ยกเลิก')
       ORDER BY rr.reviewed_at DESC`
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching approved reward requests", error);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/staff/reward-request-list", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
          rr.request_id, 
          u.e_passport, 
          u.firstname, 
          u.lastname, 
          u.facname, 
          u.depname,
          r.reward_type, 
          r.reward_name, 
          rr.requested_at, 
          rr.reviewed_at, 
          rr.status, 
          r.points_required, 
          r.reward_image,
          r.reward_id,
          rr.reason
       FROM reward_requests rr
       JOIN rewards r ON rr.reward_id = r.reward_id
       JOIN users u ON rr.user_id = u.user_id
       WHERE (r.reward_type = 'stationery' AND rr.status = 'กำลังรออนุมัติ')
       OR (r.reward_type = 'certificate' AND rr.status = 'กำลังรออนุมัติ')
       ORDER BY rr.requested_at DESC`
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching pending reward requests", error);
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/approve-reward", async (req, res) => {
  const { request_id, approved_by, approval_status, reason } = req.body;

  try {
    // Retrieve request details including the current status.
    const requestQuery = await pool.query(
      `SELECT user_id, reward_id, deducted_points, status FROM reward_requests WHERE request_id = $1`,
      [request_id]
    );

    if (requestQuery.rows.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }

    const {
      user_id,
      reward_id,
      deducted_points,
      status: currentStatus,
    } = requestQuery.rows[0];

    // Only allow processing if the request is still pending.
    if (currentStatus !== "กำลังรออนุมัติ") {
      return res
        .status(400)
        .json({ error: "This request has already been processed." });
    }

    if (approval_status === "อนุมัติ") {
      // Approval process – ignore the reason field.
      const rewardQuery = await pool.query(
        `SELECT reward_quantity FROM rewards WHERE reward_id = $1`,
        [reward_id]
      );

      if (rewardQuery.rows.length === 0) {
        return res.status(404).json({ error: "Reward not found" });
      }

      const { reward_quantity } = rewardQuery.rows[0];

      // Check if reward is still available.
      if (reward_quantity <= 0) {
        return res.status(400).json({ error: "Reward is out of stock" });
      }

      // Decrease reward quantity.
      await pool.query(
        `UPDATE rewards SET reward_quantity = reward_quantity - 1 WHERE reward_id = $1`,
        [reward_id]
      );

      // Update request status to approved (and clear any reason).
      await pool.query(
        `UPDATE reward_requests SET status = 'อนุมัติ', reviewed_at = NOW(), reason = '-' WHERE request_id = $1`,
        [request_id]
      );

      // Log approval action without reason.
      await pool.query(
        `INSERT INTO reward_approval (request_id, approved_by, approval_status, reason) VALUES ($1, $2, 'อนุมัติ', '-')`,
        [request_id, approved_by]
      );

      return res
        .status(200)
        .json({ message: "Reward request approved successfully" });
    } else {
      // Rejection process – ensure a non-empty reason is provided.
      if (!reason || reason.trim() === "") {
        return res
          .status(400)
          .json({ error: "Reason is required for rejection" });
      }

      // Refund the points back to the student.
      await pool.query(
        `UPDATE reward_points SET total_points = total_points + $1 WHERE user_id = $2`,
        [deducted_points, user_id]
      );

      // Update request status to rejected with the provided reason.
      await pool.query(
        `UPDATE reward_requests SET status = 'ยกเลิก', reviewed_at = NOW(), reason = $1 WHERE request_id = $2`,
        [reason, request_id]
      );

      // Log rejection.
      await pool.query(
        `INSERT INTO reward_approval (request_id, approved_by, approval_status, reason) VALUES ($1, $2, 'ปฏิเสธ', $3)`,
        [request_id, approved_by, reason]
      );

      return res
        .status(200)
        .json({ message: "Reward request rejected, points refunded" });
    }
  } catch (error) {
    console.error("Error approving request:", error);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/staff/point_expire", async (req, res) => {
  try {
    const query =
      "SELECT setting_value FROM global_settings WHERE setting_name = $1";
    const result = await pool.query(query, ["point_expire"]);

    if (result.rows.length > 0) {
      // Respond with the current setting value
      res.json({ setting_value: result.rows[0].setting_value });
    } else {
      res.status(404).json({ error: "Setting not found" });
    }
  } catch (error) {
    console.error("Error fetching point expire:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.put("/staff/point_expire", async (req, res) => {
  const { setting_value } = req.body;

  if (!setting_value) {
    return res.status(400).json({ error: "setting_value is required" });
  }

  try {
    const query = `
      UPDATE global_settings 
      SET setting_value = $1 
      WHERE setting_name = $2 
      RETURNING *`;
    const result = await pool.query(query, [setting_value, "point_expire"]);

    if (result.rowCount > 0) {
      res.json({
        message: "Point expire date updated successfully",
        setting: result.rows[0],
      });
    } else {
      res.status(404).json({ error: "Setting not found" });
    }
  } catch (error) {
    console.error("Error updating point expire:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* ADMIN */

app.get("/api/get-staff", async (req, res) => {
  try {
    const query = `
      SELECT u.user_id, u.e_passport, u.firstname, u.lastname, u.email, u.facname, u.depname, r.role_id
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.role_id
      WHERE u.role_id IN (2, 3);
    `;

    const result = await pool.query(query);

    if (result.rows.length > 0) {
      res.json(result.rows);
    } else {
      res.status(404).json({ message: "No users found" });
    }
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.put("/users/role", async (req, res) => {
  try {
    const { e_passport, new_role_id } = req.body;

    // Validate that the new role can only be 2 or 3
    if (![2, 3].includes(new_role_id)) {
      return res.status(400).json({
        error:
          "Invalid role. Role can only be changed to 2 (staff) or 3 (professor).",
      });
    }

    // Check if user exists and already has role 2 or 3
    const checkUserQuery = `SELECT role_id FROM users WHERE e_passport = $1 AND role_id IN (2, 3);`;
    const userResult = await pool.query(checkUserQuery, [e_passport]);

    // Update the role
    const updateQuery = `
      UPDATE users 
      SET role_id = $1, updated_at = NOW()
      WHERE e_passport = $2
      RETURNING *;
    `;

    const result = await pool.query(updateQuery, [new_role_id, e_passport]);

    if (result.rowCount > 0) {
      res.json({ message: "Role updated successfully", user: result.rows[0] });
    } else {
      res.status(404).json({ error: "User not found" });
    }
  } catch (error) {
    console.error("Error updating role:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.put("/users/:user_id/role", async (req, res) => {
  try {
    const { user_id } = req.params;
    const { new_role_id } = req.body;

    // Ensure the new role is only 2 or 3
    if (![2, 3].includes(new_role_id)) {
      return res.status(400).json({
        error:
          "Invalid role. Role can only be changed between 2 (staff) and 3 (professor).",
      });
    }

    const query = `
      UPDATE users 
      SET role_id = $1, updated_at = NOW()
      WHERE user_id = $2 AND role_id IN (2, 3)
      RETURNING *;
    `;

    const result = await pool.query(query, [new_role_id, user_id]);

    if (result.rowCount > 0) {
      res.json({ message: "Role updated successfully", user: result.rows[0] });
    } else {
      res
        .status(404)
        .json({ error: "User not found or role change not allowed" });
    }
  } catch (error) {
    console.error("Error updating role:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.delete("/users/:user_id/role", async (req, res) => {
  try {
    const { user_id } = req.params;

    const query = `
      UPDATE users 
      SET role_id = 4, updated_at = NOW()
      WHERE user_id = $1 AND role_id IN (2, 3)
      RETURNING *;
    `;

    const result = await pool.query(query, [user_id]);

    if (result.rowCount > 0) {
      res.json({
        message: "Role reset to default (student)",
        user: result.rows[0],
      });
    } else {
      res
        .status(404)
        .json({ error: "User not found or role reset not allowed" });
    }
  } catch (error) {
    console.error("Error resetting role:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
console.log(`WebSocket running on ws://0.0.0.0:${WS_PORT}`);
