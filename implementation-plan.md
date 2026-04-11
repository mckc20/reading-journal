# Implementation Plan


**Tech Stack:** React (Vite), Tailwind CSS, shadcn/ui, Supabase (PostgreSQL, Auth, Storage), Vercel.

---

## 🏗️ Phase 1: Foundation & Setup
*The goal of this phase is to wire the basic infrastructure together before writing any complex logic.*

1. **Initialize the Frontend:** - Spin up a Vite + React environment.
   - Set up TypeScript (recommended for stricter data management) or standard JavaScript.
2. **Install Tailwind & UI Components:** - Configure Tailwind CSS.
   - Initialize `shadcn/ui` to prepare foundational UI components (cards, buttons, forms, dialog modals, etc.).
3. **Create the Supabase Project:** - Create a new project in the Supabase dashboard.
   - Retrieve the API keys and URL, and add them to a local `.env` file in the React project.
4. **Initialize Version Control:** - Set up Git to track progress and prepare for future Vercel deployment.

## 🗄️ Phase 2: Database Design & Authentication
*Securely store user data and set up access protocols.*

1. **Design the Database Schema (Supabase):** - Create the `books` table (title, author, genre, pages, status, cover_url, etc.).
   - Create the `series` table.
   - Create the `reading_logs` table (timestamp, book_id, current_page, reading_time_minutes).
2. **Set up Row Level Security (RLS):** - Write security policies in Supabase to ensure users can only read, edit, insert, and delete their own data based on their `user_id`.
3. **Build Auth Flows:** - Create the Log In and Sign Up pages.
   - Implement protected routing in React so unauthenticated users cannot access the dashboard or library.

## 🛠️ Phase 3: Core Functionality (CRUD Operations)
*Build the manual data entry flows and the core user interface.*

1. **Build the "Add Book" Form:** - Create a form to manually input book properties (Title, Author, Genre, Status).
   - Implement image upload to Supabase Storage for the book cover.
2. **Create the Dashboard Layout:** - Fetch the user's active/recent books from Supabase.
   - Display them as interactive cards on the Start Page.
3. **Develop the Detail Modal:** - Build a pop-up/modal that displays a book's full properties when clicked.
   - Add functionality to update reading progress or change the book's status (e.g., from "Up Next" to "Reading").
4. **Implement Basic Library Views:** - Build out structural routing and views for "All Books," "To Be Read (TBR)," and "Series Library."

## 🚀 Phase 4: Advanced Tracking & External APIs
*Introduce the "magic" features that automate tracking and data entry.*

1. **Integrate the Barcode Scanner:** - Add a browser-based camera scanning library (like `html5-qrcode`).
   - Connect the scanned ISBN to the Google Books API or Open Library API to auto-fill the "Add Book" form (cover, author, total pages, genre).
2. **Implement Daily Logging:** - Create a UI prompt in the detail modal for users to log their current page and the time spent reading.
   - Save these entries to the `reading_logs` table.
3. **Build the Journaling Space:** - Add a rich text area within the book detail modal for personal reviews, guide questions, and favorite quotes.

## ✨ Phase 5: Insights, Polish, & Deployment
*Bring the data to life with analytics and deploy the final product.*

1. **Calculate Dashboard Insights:** - Write the logic to crunch database numbers and display dynamic stats on the Start Page.
   - Implement calculations for Reading Streaks, Pacing Predictors (estimated finish date), and Genre Breakdowns.
2. **Build the Timeline View:** - Implement a Gantt-style calendar interface using the `date_started` and `date_finished` properties from the books table.
3. **Deploy to Vercel:** - Connect the GitHub/GitLab repository to Vercel.
   - Configure build settings (`npm run build`) and add the Supabase environment variables to Vercel to complete the launch.