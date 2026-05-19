# ☁️ Microsoft Azure Hosting & Startup Registration Guide

This guide covers everything you need to know about registering for **Microsoft for Startups Founders Hub**, the requirements, the Azure services you should use, and a step-by-step roadmap to host your Service Center Management application (Django + Next.js).

---

## Part 1: Microsoft for Startups Founders Hub Registration

Microsoft offers up to **$150,000 in free Azure credits** to startups, which means you can host your application for free for the next 1–3 years.

### 📋 1. What is Required for Registration?
To get approved for the basic/unfunded tier (which gives you initial credits to start), you need:
- **A LinkedIn Profile**: Your LinkedIn profile must show that you are the Founder/Co-founder of the startup. Make sure it's updated and professional.
- **A Company Email Address**: (e.g., `saurabh@yourdomain.com`). It looks much more professional than a Gmail address.
- **Company Name & Description**: A clear explanation of what your Service Center Management SaaS does.
- **Company Website**: A simple landing page explaining your product is highly recommended. (You can host this for free on Vercel or GitHub Pages initially).
- **Date of Incorporation**: If you have registered a Pvt Ltd or LLP, keep the date handy. (Though Microsoft often accepts pre-incorporation startups for the lowest tier, having a legal entity helps you get more credits).

### 📝 2. Step-by-Step Registration Process
1. Go to the [Microsoft for Startups Founders Hub](https://startups.microsoft.com/).
2. Click **Apply Now** and sign in using your Microsoft account or LinkedIn account.
3. **Link your LinkedIn Profile**: Microsoft uses LinkedIn as a primary verification method to ensure you are a real founder.
4. **Fill out the Startup Details**:
   - Give your startup's name.
   - Describe the problem you are solving (e.g., "SaaS platform automating operations, GST billing, and inventory for computer service centers in India").
   - Enter your website URL.
5. **Submit the Application**: Approval usually takes 2 to 5 business days.
6. **Access Credits**: Once approved, you will get access to the Founders Hub portal where you can activate your Azure credits, claim OpenAI access, and get free Microsoft 365 and GitHub Enterprise licenses.

---

## Part 2: What Functionality Can You Use on Azure?

With your Azure credits, you have access to enterprise-grade infrastructure. Here is the mapping of your current tech stack to the corresponding Azure services:

| Your Tech Stack | Azure Service | Why Use It? |
| :--- | :--- | :--- |
| **Django Backend** | **Azure App Service (Web Apps)** | Fully managed platform. You push your code, and Azure handles the server, load balancing, and SSL. Best for Python/Django. |
| **Next.js Frontend** | **Azure Static Web Apps** | Perfect for Next.js. Automatically builds and deploys your frontend from GitHub. Global CDN included. |
| **PostgreSQL Database** | **Azure Database for PostgreSQL (Flexible Server)** | Fully managed database with automatic backups, high availability, and scaling. |
| **Redis (Cache & Celery)**| **Azure Cache for Redis** | High-performance in-memory cache for fast data retrieval and Celery task queues. |
| **Media / Static Files** | **Azure Blob Storage** | Secure, infinitely scalable storage for user uploads (like diagnosis photos) and static assets. |

---

## Part 3: Step-by-Step Guide for Hosting on Azure

Once you have your Azure account and credits ready, follow these steps to deploy your application.

### Step 1: Set Up the Database (Azure Database for PostgreSQL)
1. Go to the Azure Portal (`portal.azure.com`).
2. Search for **Azure Database for PostgreSQL** and click **Create**.
3. Choose **Flexible Server**.
4. Configure the server:
   - **Resource Group**: Create a new one (e.g., `service-center-rg`).
   - **Server Name**: Choose a unique name (e.g., `sc-prod-db`).
   - **Region**: Choose a region closest to your users (e.g., `Central India` or `South India`).
   - **Compute + Storage**: Choose the `Burstable` tier (B1ms) to save credits initially.
   - **Authentication**: Set an admin username and a strong password.
5. Go to **Networking** and check "Allow public access from any Azure service within Azure to this server" so your Django app can connect to it.
6. Click **Review + Create**. Save your connection string (Host, Username, Password, Database Name).

### Step 2: Set Up Media Storage (Azure Blob Storage)
1. Search for **Storage Accounts** and click **Create**.
2. Give it a name (e.g., `scmediastorage`).
3. Once created, go to **Containers** on the left menu.
4. Create a container named `media` and set the Public Access Level to **Blob** (so users can view the images).
5. Go to **Access Keys** and copy the `Connection String`. You will add this to your Django `.env` file, and install `django-storages` to handle Azure uploads.

### Step 3: Deploy the Django Backend (Azure App Service)
1. Search for **App Services** and click **Create** -> **Web App**.
2. Configure the app:
   - **Publish**: Choose **Code**.
   - **Runtime Stack**: Select **Python 3.10** (or your current version).
   - **Operating System**: Linux.
   - **Region**: Central India.
   - **App Service Plan**: Create a new one (Basic B1 or Standard S1).
3. Under **Deployment**, link your GitHub account. Select your backend repository and branch (e.g., `main`). Azure will automatically generate a GitHub Actions workflow to deploy your code on every push.
4. Once created, go to the App Service page, click **Configuration** on the left menu, and add your Environment Variables (Application Settings):
   - `DEBUG`: `False`
   - `SECRET_KEY`: *Your strong secret key*
   - `ALLOWED_HOSTS`: `*` (or your specific Azure app URL)
   - `DATABASE_URL`: *The connection string from Step 1*
   - `AZURE_STORAGE_CONNECTION_STRING`: *The string from Step 2*
5. In your GitHub repository, ensure you have a `requirements.txt` file and a `startup.sh` script to run migrations:
   ```bash
   python manage.py migrate
   gunicorn core.wsgi:application
   ```

### Step 4: Deploy the Next.js Frontend (Azure Static Web Apps)
1. Search for **Static Web Apps** and click **Create**.
2. Configure the app:
   - **Name**: e.g., `sc-frontend-prod`.
   - **Plan Type**: Standard (to use credits and custom domains).
   - **Source**: GitHub.
3. Link your GitHub account and select your frontend repository.
4. Under Build Details:
   - **Build Presets**: Next.js.
   - **App Location**: `/` (or `/frontend` if it's in a subfolder).
   - **Api Location**: Leave blank.
   - **Output Location**: `.next`
5. Click **Review + Create**. Azure will automatically set up a GitHub Action that builds and deploys your Next.js app globally.
6. Once deployed, go to the Static Web App configuration and add your `.env` variables (e.g., `NEXT_PUBLIC_API_URL` pointing to your Django App Service URL).

### Step 5: (Optional) Set up Redis for Background Tasks
If you are using Celery for SMS and Email notifications:
1. Search for **Azure Cache for Redis** and click **Create**.
2. Select the **Basic** tier.
3. Once deployed, copy the `Primary Connection String` and add it as the `REDIS_URL` in your Django App Service configuration.

### Step 6: Custom Domains & SSL
1. Go to your frontend Static Web App and your backend App Service.
2. Click on **Custom domains**.
3. Follow the instructions to add a CNAME record to your domain provider (e.g., GoDaddy, Namecheap) pointing to your Azure URLs.
4. Azure provides **Free Managed SSL Certificates**, which you can generate and bind directly from the portal with one click!

---

> [!TIP]
> **To get started today:**
> 1. Make sure your LinkedIn is updated.
> 2. Create the Microsoft for Startups account and apply.
> 3. While waiting for approval (2-5 days), you can create a free Azure account (which gives $200 free credit for 30 days) to practice the deployment steps above!
