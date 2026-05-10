# Server Boilerplate

A robust, production-ready Node.js + Express.js starter kit. This repository provides a solid foundation for building secure, scalable backend applications with built-in best practices.

**Use this as a starting point for your new projects.**

## 🚀 Features

- **Authentication**: JWT-based auth (Access/Refresh tokens), Session Management, Google OAuth.
- **Security**: Helmet, CORS, Rate Limiting, Sanitization (NoSQL/XSS), Parameter Pollution protection.
- **Database**: MongoDB integration with Mongoose.
- **File Handling**: Professional upload system (Multer + Cloudinary) with validation.
- **Email Service**: Template-based emails using Nodemailer.
- **DevOps**: Docker & Docker Compose setup.
- **Structure**: Modular architecture (Controllers, Services, Routes, Utils).
- **Testing**: Jest infrastructure ready.

## 🛠️ Getting Started

### 1. Clone & Setup

To use this boilerplate for a new project, simply copy the files or clone the repo:

```bash
# Clone the repository
git clone <repo-url> my-new-project

# Navigate into the directory
cd my-new-project

# Install dependencies
npm install
```

### 2. Configure Environment

Create a `.env` file in the root directory and copy the contents from `.env.example`.

```bash
cp .env.example .env
```

**Required Configuration:**
- `MONGODB_URI`: Connection string for your MongoDB database.
- `JWT_SECRET` / `JWT_REFRESH_SECRET`: Secure random strings for token signing.
- `SMTP_*`: Your email provider credentials (for sending emails).
- `CLOUDINARY_*`: Your Cloudinary credentials (for file uploads).

### 3. Run the Server

**Development Mode:**
Running with `nodemon` for hot-reloading:
```bash
npm run dev
```

**Production Mode:**
```bash
npm start
```

**Using Docker:**
```bash
docker-compose up -d --build
```

## 📂 Project Structure

```
src/
├── config/         # Configuration (DB, Cloudinary, Firebase, Uploads)
├── controllers/    # Request handlers (Auth, Files, etc.)
├── middleware/     # Custom middleware (Auth, Logger, Validation, Security)
├── models/         # Mongoose schemas (User, Session)
├── routes/         # API Route definitions
├── services/       # Business logic (Email, Files)
├── utils/          # Helpers (Error Classes, JWT, Sanitization)
├── app.js          # Express application setup
└── server.js       # Server entry point
tests/              # Unit & Integration tests
scripts/            # Utility scripts
```

## 🔒 Security Features

This boilerplate comes pre-configured with industry-standard security practices:
- **Helmet**: Sets secure HTTP headers.
- **CORS**: Configured interactions between client/server.
- **Rate Limit**: Prevents brute-force attacks.
- **Mongo Sanitize**: Prevents NoSQL injection.
- **XSS Clean**: Sanitizes user input against XSS.
- **HPP**: Protects against HTTP Parameter Pollution.

## 🧪 Testing

The project is set up with **Jest**.

```bash
# Run all tests
npm test

# Run specific test file
npm test tests/integration/health.test.js
```

## 📝 License

ISC
