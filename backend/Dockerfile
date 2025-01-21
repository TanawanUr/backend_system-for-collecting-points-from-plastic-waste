# ใช้ Node.js image เป็น base
FROM node:14

# สร้างไดเรกทอรีใน container สำหรับแอป
WORKDIR /app

# คัดลอก package.json และ package-lock.json (ถ้ามี)
COPY package*.json ./

# ติดตั้ง dependencies
RUN npm install

# คัดลอกไฟล์ของแอปไปยังไดเรกทอรีใน container
COPY . .

# กำหนดพอร์ตที่จะใช้ใน container
EXPOSE 3000

# คำสั่งในการรันแอปพลิเคชัน
CMD ["node", "index.js"]
