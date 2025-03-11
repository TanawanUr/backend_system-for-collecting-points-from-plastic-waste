CREATE TABLE "action_logs" (
  "log_id" SERIAL PRIMARY KEY,
  "user_id" INT,
  "action_description" TEXT NOT NULL,
  "faculty" VARCHAR(100),
  "department" VARCHAR(100),
  "action_month" INT,
  "action_year" INT,
  "action_timestamp" TIMESTAMP DEFAULT (NOW())
);

CREATE TABLE "affective_scores" (
  "score_id" SERIAL PRIMARY KEY,
  "user_id" INT,
  "subject_id" INT,
  "score" INT NOT NULL,
  "created_at" TIMESTAMP DEFAULT (NOW()),
  "updated_at" TIMESTAMP DEFAULT (NOW())
);

CREATE TABLE "bottle_records" (
  "record_id" SERIAL PRIMARY KEY,
  "user_id" INT,
  "bottle_count" INT,
  "image_url" TEXT,
  "create_at" DATE DEFAULT (NOW()),
);

CREATE TABLE "global_settings" (
  "setting_name" VARCHAR(50) PRIMARY KEY,
  "setting_value" TEXT NOT NULL
);

CREATE TABLE "reward_approval" (
  "approval_id" SERIAL PRIMARY KEY,
  "request_id" INT,
  "approved_by" INT,
  "approval_timestamp" TIMESTAMP DEFAULT (NOW()),
  "approval_status" VARCHAR(20) NOT NULL,
  "reason" TEXT
);

CREATE TABLE "reward_points" (
  "point_id" SERIAL PRIMARY KEY,
  "user_id" INT,
  "total_points" INT NOT NULL DEFAULT 0,
  "point_expire" date,
  "updated_at" TIMESTAMP DEFAULT (NOW())
);

CREATE TABLE "reward_requests" (
  "request_id" SERIAL PRIMARY KEY,
  "user_id" INT,
  "reward_id" INT,
  "status" VARCHAR(20) DEFAULT 'กำลังรออนุมัติ',
  "deducted_points" INT DEFAULT 0,
  "reason" TEXT,
  "requested_at" TIMESTAMP DEFAULT (NOW()),
  "reviewed_at" TIMESTAMP
);

CREATE TABLE "rewards" (
  "reward_id" SERIAL PRIMARY KEY,
  "reward_type" VARCHAR(50) NOT NULL,
  "reward_name" TEXT NOT NULL,
  "reward_quantity" INT NOT NULL,
  "points_required" INT NOT NULL,
  "reward_image" TEXT,
  "created_at" TIMESTAMP DEFAULT (NOW()),
  "updated_at" TIMESTAMP DEFAULT (NOW())
);

CREATE TABLE "roles" (
  "role_id" SERIAL PRIMARY KEY,
  "role_name" VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE "subject" (
  "subject_id" SERIAL PRIMARY KEY,
  "subject_name" varchar(50)
);

CREATE TABLE "users" (
  "user_id" SERIAL PRIMARY KEY,
  "e_passport" VARCHAR(100) NOT NULL,
  "firstname" VARCHAR(100) NOT NULL,
  "lastname" VARCHAR(100) NOT NULL,
  "email" VARCHAR(100) NOT NULL,
  "token" TEXT NOT NULL,
  "facname" VARCHAR(100) NOT NULL,
  "depname" VARCHAR(100) NOT NULL,
  "role_id" INT,
  "created_at" TIMESTAMP DEFAULT (NOW()),
  "updated_at" TIMESTAMP DEFAULT (NOW())
);


ALTER TABLE "users" ADD FOREIGN KEY ("role_id") REFERENCES "roles" ("role_id");

ALTER TABLE "reward_points" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("user_id");

ALTER TABLE "reward_requests" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("user_id");

ALTER TABLE "reward_requests" ADD FOREIGN KEY ("reward_id") REFERENCES "rewards" ("reward_id");

ALTER TABLE "action_logs" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("user_id");

ALTER TABLE "reward_approval" ADD FOREIGN KEY ("request_id") REFERENCES "reward_requests" ("request_id");

ALTER TABLE "reward_approval" ADD FOREIGN KEY ("approved_by") REFERENCES "users" ("user_id");

ALTER TABLE "bottle_records" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("user_id");

INSERT INTO "global_settings" ("setting_name", "setting_value")
VALUES ('point_expire', '2025-12-31');

INSERT INTO "subjet" ("subject_name")
VALUES ('การเขียนโปรแกรม'), ('คิดนอกกรอบ')

INSERT INTO "roles" ("role_id", "role_name")
VALUES ('1','admin'), ('2','staff'), ('3','professor'), ('4','student');
