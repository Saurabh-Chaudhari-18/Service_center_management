# Service Center Management System

A comprehensive full-stack web application for managing computer and laptop service centers in India. This system provides complete workflow management from job card creation to billing, with multi-branch support, role-based access control, and GST compliance.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Screenshots](#screenshots)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Development](#development)
- [Deployment](#deployment)

## 🎯 Overview

The Service Center Management System is designed specifically for Indian computer and laptop service centers, offering a complete solution for managing operations across multiple branches. The system handles everything from customer intake and job card management to inventory tracking, billing with GST compliance, and comprehensive reporting.

**Key Highlights:**

- 🏢 Multi-branch support with data isolation
- 👥 Role-based access control (Owner, Manager, Receptionist, Technician, Accountant)
- 💰 GST-compliant billing (CGST+SGST and IGST)
- 📦 Automated inventory management
- 🔐 Encrypted device password storage
- 📊 Comprehensive reporting and analytics
- 🔔 SMS/WhatsApp notifications
- 📝 Complete audit trail

## ✨ Features

### 🎫 Job Card Management

- Complete job lifecycle tracking (Registered → Diagnosed → Approved → In Progress → Completed → Ready → Delivered)
- Device information capture with photo upload
- Accessories tracking
- Encrypted device password storage with access logging
- Warranty information and details
- Job timeline and status history
- Customer approval workflow for estimates
- OTP/signature verification for delivery
- Print-ready job card format

### 👥 Role-Based Access Control (RBAC)

- **Owner**: Full system access across all branches
- **Manager**: Branch management, job assignment, inventory control
- **Receptionist**: Customer and job card creation
- **Technician**: Diagnosis, repair work, part requests
- **Accountant**: Billing, payments, financial reports

### 💳 Billing & GST Compliance

- Automated GST calculation (CGST+SGST for intra-state, IGST for inter-state)
- Sequential invoice numbering per branch
- Multiple payment methods (Cash, Card, UPI, Bank Transfer)
- Partial and full payment support
- PDF invoice generation
- Payment history tracking
- Outstanding amount tracking

### 📦 Inventory Management

- Branch-wise inventory tracking
- Automated stock deduction on part usage
- Low stock alerts
- Stock adjustment with audit trail
- Part request workflow from technicians
- Inventory consumption reports
- Multi-location stock management

### 👤 Customer Management

- Customer database per branch
- Mobile number-based search
- Service history tracking
- Pending jobs overview
- Invoice history
- Customer analytics and insights

### 🔔 Notifications & Alerts

- SMS and WhatsApp integration
- Automatic notifications for job status changes
- Delivery ready alerts
- Payment reminder notifications
- Low stock alerts
- Customizable notification templates

### 📊 Reports & Analytics

- Revenue reports with date range filtering
- Technician productivity analysis
- Inventory consumption tracking
- Customer analysis and insights
- GST summary reports
- Excel export functionality
- Real-time dashboard metrics

### 🔒 Security & Audit

- Immutable audit logs for all critical operations
- Device password access tracking
- User login history
- Invoice/payment modification logs
- Branch-level data isolation
- Encrypted sensitive data storage

## 📸 Screenshots

> [!NOTE]
> Screenshots showcase the main features of the system for clients and recruiters to visualize the application.

### Dashboard

_Coming soon - Main dashboard with key metrics and quick actions_

### Job Management

_Coming soon - Job card creation, listing, and detailed job view with timeline_

### Billing & Invoices

_Coming soon - Invoice generation, GST breakdown, and payment recording_

### Inventory Tracking

_Coming soon - Inventory management with stock levels and alerts_

### Reports

_Coming soon - Analytics dashboard with charts and export options_

> To add screenshots, place images in the `screenshots/` directory and update this section with:
>
> ```markdown
> ![Dashboard](screenshots/dashboard.png)
> ```

## 🛠 Technology Stack

### Frontend

- **Framework**: Next.js 16.1.1 (React 19.2.3)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4.0
- **UI Components**: Headless UI, Lucide React
- **Form Handling**: React Hook Form with Zod validation
- **State Management**: TanStack React Query 5.90
- **HTTP Client**: Axios
- **Charts**: Recharts
- **Date Handling**: date-fns

### Backend

- **Framework**: Django REST Framework
- **Language**: Python 3.x
- **Database**: PostgreSQL (production) / SQLite (development)
- **Authentication**: JWT (JSON Web Tokens)
- **Encryption**: Fernet (for device passwords)
- **PDF Generation**: ReportLab / WeasyPrint
- **Task Queue**: Celery (for notifications)
- **API Documentation**: DRF Spectacular / Postman Collection

### DevOps & Tools

- **Version Control**: Git
- **Package Management**: npm (frontend), pip (backend)
- **Environment Management**: python venv
- **Code Quality**: ESLint, Pylint
- **API Testing**: Postman (collection included)

## 🏗 Architecture

The application follows a **multi-tenant architecture** with branch-level data isolation:

```
┌─────────────────┐
│  Organization   │
└────────┬────────┘
         │
         ├─── Branch 1 (Mumbai)
         │    ├── Users
         │    ├── Customers
         │    ├── Jobs
         │    ├── Inventory
         │    └── Invoices
         │
         ├─── Branch 2 (Delhi)
         │    └── (Independent data)
         │
         └─── Branch 3 (Pune)
              └── (Independent data)
```

**Key Design Principles:**

- Branch-scoped data queries (no cross-branch data leaks)
- Immutable audit logs for compliance
- Transactional operations for data consistency
- Encrypted sensitive data at rest
- RESTful API design with comprehensive error handling

## 🚀 Getting Started

### Prerequisites

- **Python**: 3.8 or higher
- **Node.js**: 18.x or higher
- **npm**: 9.x or higher
- **Database**: PostgreSQL (recommended for production) or SQLite (development)

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

4. **Configure environment variables:**

   Create a `.env` file in the Backend directory:

   ```env
   SECRET_KEY=your-secret-key-here
   DEBUG=True
   DATABASE_URL=sqlite:///db.sqlite3
   ENCRYPTION_KEY=your-fernet-encryption-key
   ```

5. **Run migrations:**

   ```bash
   python manage.py migrate
   ```

6. **Create a superuser (admin account):**

   ```bash
   python manage.py createsuperuser
   ```

7. **Start the development server:**
   ```bash
   python manage.py runserver 8001
   ```

The backend API will be available at `http://localhost:8001`

### Frontend Setup

1. **Navigate to the frontend directory:**

   ```bash
   cd frontend
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Configure environment variables:**

   Create a `.env.local` file in the frontend directory:

   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8001/api
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

The frontend application will be available at `http://localhost:3000`

### Initial Setup

1. Access the admin panel at `http://localhost:8001/admin` with your superuser credentials
2. Create an Organization
3. Create one or more Branches under the organization
4. Create user accounts and assign roles
5. Access the frontend application and log in

## 📁 Project Structure

```
Service_center_management/
├── Backend/
│   ├── config/                 # Django project settings
│   ├── core/                   # User, Organization, Branch models
│   ├── customers/              # Customer management
│   ├── jobs/                   # Job card management
│   ├── inventory/              # Inventory tracking
│   ├── billing/                # Invoices and payments
│   ├── notifications/          # SMS/WhatsApp notifications
│   ├── reports/                # Analytics and reporting
│   ├── audit/                  # Audit logs
│   ├── manage.py               # Django management script
│   ├── requirements.txt        # Python dependencies
│   └── README.md               # Detailed API documentation
│
├── frontend/
│   ├── src/
│   │   ├── app/                # Next.js app directory
│   │   │   ├── dashboard/      # Dashboard page
│   │   │   ├── jobs/           # Job management pages
│   │   │   ├── customers/      # Customer management
│   │   │   ├── inventory/      # Inventory pages
│   │   │   ├── billing/        # Billing and invoices
│   │   │   └── reports/        # Reports and analytics
│   │   ├── components/         # Reusable React components
│   │   ├── lib/                # Utilities and API client
│   │   └── types/              # TypeScript type definitions
│   ├── public/                 # Static assets
│   ├── package.json            # Node dependencies
│   └── README.md               # Frontend documentation
│
└── README.md                   # This file
```

## 📚 API Documentation

Comprehensive API documentation is available in the [Backend README](Backend/README.md), including:

- Complete API endpoint reference
- Role permissions matrix
- Request/response examples
- Authentication and authorization guide
- Error handling documentation
- Postman collection for testing

**Quick API Overview:**

- **Authentication**: `/api/auth/token/`
- **Organizations**: `/api/core/organizations/`
- **Branches**: `/api/core/branches/`
- **Users**: `/api/core/users/`
- **Customers**: `/api/customers/customers/`
- **Jobs**: `/api/jobs/jobs/`
- **Inventory**: `/api/inventory/items/`
- **Billing**: `/api/billing/invoices/`
- **Reports**: `/api/reports/`

## 💻 Development

### Running Tests

**Backend:**

```bash
cd Backend
pytest
pytest --cov=. --cov-report=html  # With coverage
```

**Frontend:**

```bash
cd frontend
npm run lint
npm run build  # Verify production build
```

### Common Development Tasks

**Backend:**

- Create migrations: `python manage.py makemigrations`
- Apply migrations: `python manage.py migrate`
- Create superuser: `python manage.py createsuperuser`
- Run development server: `python manage.py runserver 8001`

**Frontend:**

- Development server: `npm run dev`
- Production build: `npm run build`
- Start production server: `npm start`
- Lint code: `npm run lint`

### Code Quality

- Follow PEP 8 style guide for Python code
- Use ESLint configuration for TypeScript/React code
- Write meaningful commit messages
- Add comments for complex business logic
- Update documentation when adding features

## 🚢 Deployment

### Backend Deployment Checklist

1. ✅ Set `DEBUG=False` in production
2. ✅ Use PostgreSQL database
3. ✅ Generate secure `SECRET_KEY` and `ENCRYPTION_KEY`
4. ✅ Configure `ALLOWED_HOSTS`
5. ✅ Set up HTTPS/SSL
6. ✅ Configure static files with `collectstatic`
7. ✅ Set up SMS/WhatsApp API credentials
8. ✅ Configure email settings
9. ✅ Set up logging and monitoring
10. ✅ Configure database backups

### Frontend Deployment Checklist

1. ✅ Update `NEXT_PUBLIC_API_URL` to production API
2. ✅ Run production build: `npm run build`
3. ✅ Test production build locally: `npm start`
4. ✅ Configure CDN for static assets
5. ✅ Set up environment variables on hosting platform
6. ✅ Enable caching strategies
7. ✅ Configure domain and SSL

**Recommended Hosting:**

- Backend: Railway, Render, DigitalOcean, AWS
- Frontend: Vercel, Netlify, Railway
- Database: Railway PostgreSQL, Supabase, AWS RDS

## 📄 License

This project is proprietary software developed for service center management.

---

**For detailed API documentation and backend architecture, see [Backend/README.md](Backend/README.md)**

**For frontend component documentation, see [frontend/README.md](frontend/README.md)**
