# Smart Queue Management System for Banking Operations

An enterprise-grade, real-time banking queue management web application designed for national branch lobbies. Optimizes customer throughput, tracks counter operational states, and offers time-sensitive AI wait forecasts.

---

## 🛠️ Technology Stack
*   **Frontend**: React, Vite, Tailwind CSS, Redux Toolkit, Lucide icons, Chart.js.
*   **Backend**: Node.js, Express, Socket.io (Isolated rooms by branch).
*   **Database**: MongoDB, Mongoose ODM.
*   **Aesthetics**: Premium Glassmorphism, tailored dark theme palette, micro-animations.

---

## 🚀 Key Features
1.  **AI Wait Predictions**: Uses queueing theory models (Little's Law) and time/day density multipliers to predict waiting delays.
2.  **Cryptographic Ledger**: Blockchain-style audit trail logging where entries chain-link preceding hashes to guarantee zero-tamper audits.
3.  **Entrance QR Check-in**: Scannable branch lobby QR codes allowing automated virtual token dispatch.
4.  **Central Regional Monitor**: Zentralized dashboard comparing throughput across all branch locations for admins.
5.  **Multi-Format Reporting**: Export period-based branch performance audits directly in Excel and PDF.

---

## 📦 Getting Started

### 1. Prerequisites
*   Node.js (v18+)
*   MongoDB Instance

### 2. Environment Variables (`.env`)
Create a `.env` in the root and configure:
```ini
MONGODB_URI=mongodb://localhost:27017/smart-queue
JWT_SECRET=your_jwt_signature_secret
PORT=5000
```

### 3. Server Installation & Start
Navigate to `/server` directory:
```bash
cd server
npm install
npm run dev
```

### 4. Client Installation & Start
Navigate to root directory:
```bash
npm install
npm run dev
```

---

## 🧪 Running Integration Tests
To execute security, auditing, and AI mathematical validation checks:
```bash
node server/tests/apiIntegration.test.js
```

---

## 📄 Complete Guides & Manuals
For details on deployment, system design, predictive math formulas, database structure, and deployment stack configurations:
*   [Hosting & Deployment Guide](./DEPLOYMENT.md)
*   [System Architecture & Operations Guide](./brain/e0791ddb-5e3c-4426-add3-b25c6d80a1ac/system_architecture_and_user_guide.md)
*   [Database Design Documentation](./brain/e0791ddb-5e3c-4426-add3-b25c6d80a1ac/database_design.md)
