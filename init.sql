CREATE TABLE "reward" (
  "reward_id" SERIAL PRIMARY KEY,
  "reward_type" varchar,
  "subject_id" int,
  "des" text,
  "point_required" int,
  "create_at" timestamp,
  "update_at" timestamp
);

CREATE TABLE "subject" (
  "subject_id" SERIAL PRIMARY KEY,
  "subject_name" varchar(50)
);

CREATE TABLE "roles" (
  "role_id" SERIAL PRIMARY KEY,
  "role_name" VARCHAR(50) UNIQUE NOT NULL
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

CREATE TABLE "reward_points" (
  "point_id" SERIAL PRIMARY KEY,
  "user_id" INT,
  "total_points" INT NOT NULL DEFAULT 0,
  "point_expire" date,
  "updated_at" TIMESTAMP DEFAULT (NOW())
);

CREATE TABLE "rewards" (
  "reward_id" SERIAL PRIMARY KEY,
  "reward_type" VARCHAR(50) NOT NULL,
  "description" TEXT NOT NULL,
  "points_required" INT NOT NULL,
  "created_at" TIMESTAMP DEFAULT (NOW()),
  "updated_at" TIMESTAMP DEFAULT (NOW())
);

CREATE TABLE "reward_requests" (
  "request_id" SERIAL PRIMARY KEY,
  "user_id" INT,
  "reward_id" INT,
  "status" VARCHAR(20) DEFAULT 'กำลังรออนุมัติ',
  "reason" TEXT,
  "requested_at" TIMESTAMP DEFAULT (NOW()),
  "reviewed_at" TIMESTAMP
);

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

CREATE TABLE "api_role_mapping" (
  "api_role" VARCHAR(50) PRIMARY KEY,
  "system_role_id" INT
);

CREATE TABLE "reward_approval" (
  "approval_id" SERIAL PRIMARY KEY,
  "request_id" INT,
  "approved_by" INT,
  "approval_timestamp" TIMESTAMP DEFAULT (NOW()),
  "approval_status" VARCHAR(20) NOT NULL
);

CREATE TABLE "bottle_records" (
  "record_id" SERIAL PRIMARY KEY,
  "user_id" INT,
  "bottle_count" INT NOT NULL,
  "image_url" TEXT,
  "created_at" TIMESTAMP DEFAULT (NOW())
);

ALTER TABLE "reward" ADD FOREIGN KEY ("subject_id") REFERENCES "subject" ("subject_id");

ALTER TABLE "users" ADD FOREIGN KEY ("role_id") REFERENCES "roles" ("role_id");

ALTER TABLE "reward_points" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("user_id");

ALTER TABLE "reward_requests" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("user_id");

ALTER TABLE "reward_requests" ADD FOREIGN KEY ("reward_id") REFERENCES "rewards" ("reward_id");

ALTER TABLE "action_logs" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("user_id");

ALTER TABLE "api_role_mapping" ADD FOREIGN KEY ("system_role_id") REFERENCES "roles" ("role_id");

ALTER TABLE "reward_approval" ADD FOREIGN KEY ("request_id") REFERENCES "reward_requests" ("request_id");

ALTER TABLE "reward_approval" ADD FOREIGN KEY ("approved_by") REFERENCES "users" ("user_id");

ALTER TABLE "bottle_records" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("user_id");
