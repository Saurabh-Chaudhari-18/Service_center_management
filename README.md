
# 🛠️ Service Center Management Software

Welcome to the ultimate, all-in-one **Service Center Management** application designed specifically for electronics, IT, and mobile repair businesses. This platform replaces scattered tools, Excel sheets, and manual processes with a centralized, professional system.

---

## 📸 System Overview

Our application provides a modern, fast, and secure interface for business owners, managers, receptionists, technicians, and accountants.

### 1. Executive Dashboard

_Get an at-a-glance view of your entire business operations._
![Dashboard Preview]
<img width="1919" height="866" alt="image" src="https://github.com/user-attachments/assets/cd55bb09-aa2a-44d7-ba83-f6479ca782f6" />


### 2. Smart Inventory Management

_Airtight control over your spare parts and accessories._
![Inventory Preview]
<img width="1918" height="865" alt="image" src="https://github.com/user-attachments/assets/93702ae1-7bce-420a-ad1a-903a9443aabd" />


### 3. Professional GST Invoicing

_Generate beautiful, compliant bills in seconds._
![Billing Preview]<img width="610" height="616" alt="image" src="https://github.com/user-attachments/assets/3510b2d0-dd7f-4b31-b85b-e7efbcea5f7f" />


---

## ✨ Core Functionalities

### 📋 Full Job Card Lifecycle
<img width="822" height="55" alt="image" src="https://github.com/user-attachments/assets/bf7be1e0-331a-43c2-932f-30e0668aa21d" />


Track repairs from the moment a customer walks in to the moment they leave.

- **Digital Intake:** Attach photos, select device conditions, and log customer complaints.
- **Workflow Tracking:** Real-time statuses (`Received` -> `Diagnosis` -> `Estimate Shared` -> `Repair in Progress` -> `Ready for Delivery`).
- **Secure Handovers:** Delivery is authenticated via an OTP sent to the customer, ensuring devices are given to the right person.
- **Password Vault:** Securely log device passwords for technician access while maintaining a digital audit trail.

### 📦 Zero-Leakage Inventory Control

Never wonder where a spare part went again.

- **Multi-Branch Visibility:** Track stock centrally or filter by specific store locations.
- **Auto-Deduction:** Stock is automatically deducted when a part is added to a job card or billed directly over the counter.
- **Low Stock Alerts:** Get visual warnings when essential items (like RAM or SSDs) drop below a predefined threshold.
- **Stock Audit History:** Every manual adjustment or job-usage deducts stock with a logged reason and the user who did it.

### 💸 GST-Ready Billing & Payments

Turn completed jobs into professional invoices with a single click.

- **Automated Tax Calculation:** Automatically splits taxes into CGST, SGST, or IGST based on the customer's state/location.
- **Direct Part Sales:** Bill inventory parts directly to walk-in customers without needing a Job Card.
- **Flexible Payments:** Accept partial payments, advance amounts, and record multiple payment methods (UPI, Cash, Card, NEFT).
- **Branded PDFs:** Generate and download professional PDF invoices complete with the organization's logo and bank details.

### 🏢 Multi-Branch & Universal Management
<img width="1654" height="660" alt="image" src="https://github.com/user-attachments/assets/06cedba4-070e-4ce9-ad9c-13945a531ea2" />

Perfect for businesses expanding to multiple locations.

- **Universal Invoices:** Owners can create cross-branch "universal" invoices when needed.
- **Organization Branding:** Customize the app's logo, colors, and global terms & conditions.
- **Role-Based Access Control:** Built-in roles (Owner, Manager, Technician, Accountant, Receptionist) restrict who can see and do what in the system.

### 📱 Automated Customer Communication

Stop answering the phone just to give status updates.

- **Automated SMS/WhatsApp:** Customers receive instant updates when their device is received, an estimate is ready, or the device is ready for pickup.

---

## 💻 Tech Stack

- **Frontend:** Next.js (App Router), React, Tailwind CSS, TypeScript, React Query, React Hook Form
- **Backend:** Django, Django REST Framework, PostgreSQL
- **Security:** JWT Authentication, Role-Based Access Control (RBAC)

---

## 🚀 How to Run the Project (Local Setup)

### Backend Setup

1. **Navigate to the Backend directory:**

   ```bash
   cd Backend
   ```

2. **Create and activate a virtual environment:**
   - Windows:
     ```powershell
     python -m venv venv
     .\venv\Scripts\activate
     ```
   - macOS/Linux:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

3. **Install dependencies:**

   ```bash
   pip install -r requirements.txt
   ```

4. **Run migrations:**

   ```bash
   python manage.py migrate
   ```

5. **Start the server:**
   ```bash
   python manage.py runserver 8001
   ```

### Frontend Setup

1. **Navigate to the frontend directory:**

   ```bash
   cd frontend
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

---

## 🌍 Deployment

- **Deploy locally for testing** (Docker Compose): `cp deploy/env.docker.example .env`, edit `.env` (set `SECRET_KEY`, `ENCRYPTION_KEY`), then `docker compose up --build -d`. See [DEPLOYMENT.md](DEPLOYMENT.md#deploy-locally-for-testing-docker-compose).
- **Deploy on AWS EC2** (bare metal): See [DEPLOYMENT.md](DEPLOYMENT.md) for step-by-step instructions, scripts, and troubleshooting.
