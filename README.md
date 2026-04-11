# Reading Journal Web App

## 📖 Project Overview
The Reading Journal Web App is a dedicated platform designed to store, document, and track books and reading progress. It features advanced capabilities like automated barcode scanning, precise reading time tracking, custom data visualizations, and multi-user support.

## 🛠️ Technology Stack
- **Frontend Framework:** React (via Vite)
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui
- **Backend & Database:** Supabase (PostgreSQL, Authentication, Storage)
- **Hosting:** Vercel (Frontend)
- **External APIs:** Google Books API / Open Library API (for ISBN fetching)
- **Barcode Scanning:** `html5-qrcode` (or similar browser-based camera library)

## 🚀 Core Features & Requirements

### 1. Authentication & Multi-User Support
- **Initial Page:** A welcoming landing page explaining what the "Reading Journal" is, featuring introductory text and preview images.
- **Auth Flow:** Log In and Sign Up buttons.
- **Multi-Account Support:** Handled securely via Supabase Authentication (Email/Password). Each user's data will be isolated in the Supabase PostgreSQL database using Row Level Security (RLS).

### 2. Dashboard (Start Page)
- **Currently Reading & Recently Finished:** Quick access to active and recently completed books, displayed as cards.
- **Insights Block:** A dynamic dashboard section displaying personalized reading stats (detailed in Section 9).
- **Navigation:** Easy access to all library views.
- **Interactivity:** Clicking a book card opens a detailed pop-up/modal with properties and journal content.

### 3. Book Properties & Data Structure
Each book entity must support the following properties:
- **Basic Information:**
  - Cover Image (stored in Supabase Storage)
  - Author
  - Genre
  - Status: `Wishlist`, `Not Started`, `Up Next`, `Reading`, `Finished`, `DNF` (Did Not Finish)
  - Progress: Visual percentage bar calculated from current/total pages
  - Rating: 1-5 stars (with an exclusive "Heart" toggle for all-time favorites)
  - Current Page / Total Pages
  - Current Chapter / Total Chapters
  - Date Started & Date Finished
- **Details:**
  - Language: `German`, `Spanish`, `English`
  - Belongs to: `Me`, `Family`, `Friends`, `Library`
  - Format: `eBook`, `Audiobook`, `Paperback`, `Hardcover`
- **Series Info (Conditional):**
  - Series Name
  - Volume/Entry Number

### 4. Content & Journaling
Beneath the properties section on a book's detail page, there are two distinct tabs:
- **Journal Tab:** - Rich text area for personal reviews and analyses.
  - Includes pre-defined "Guide Questions" to prompt thoughtful reviews.
  - Dedicated space for logging "Favorite Quotes".
- **Analytics Tab:** - Visual graphs and charts specific to the individual book's reading history.

### 5. Advanced Tracking (Pages & Time)
- **Daily Page Logging:** Users can log their current page/chapter every day. The database will store the timestamp, page, and chapter to generate pacing graphs.
- **Time Tracking:** When updating the current page, users have the option to manually enter the time spent reading (e.g., "45 mins"). This data is used to calculate reading speed and total hours read.

### 6. Adding New Books
- **Manual Entry:** Standard form to fill out book properties.
- **Barcode/ISBN Scanner:** Uses the device's camera to scan the barcode on the back of a physical book.
  - The app pings a public API (Google Books/Open Library) to auto-fill the cover, author, total pages, and genre.
  - If the API data implies a series, the app will prompt the user: *"Link to existing series?"* via a dropdown menu.

### 7. Library Views & Navigation
The app features multiple ways to visualize and filter the database:
- **Library:** Sortable list (e.g., Favorites, Finished, All Books).
- **Series Library:** Grouped by series.
- **To Be Read (TBR):** Filtered view of unread books.
- **Timeline:** A Gantt-style calendar with bars marking the start and end dates of each book. Includes a "Through Time" tab grouping read books by month.
- **Authors:** Grouped by author.
- **Genres:** Grouped by genre.
- **Languages:** Grouped by language.

### 8. Series Management
- **Series Cards:** Clicking a series card opens a detailed view.
- **Series Content:** Shows overarching series properties

Beneath the properties section on a series's detail page, there are two distinct tabs:
- **Journal Tab:** - Rich text area for personal reviews and analyses.
  - Includes pre-defined "Guide Questions" to prompt thoughtful reviews.
  - Dedicated space for logging "Favorite Quotes".
- **Analytics Tab:** - Visual graphs and charts specific to the individual series's reading history.

a space for a series review, and a chronological list of all books belonging to that series, visually distinguishing between "Read" and "Unread" entries.

### 9. Insights & Analytics
Data visualizations displayed on the Start Page and dedicated wrap-ups:
- **Ongoing Insights (Dashboard):**
  - *Pacing Predictor:* Estimated completion date for current reads based on average pages-per-day.
  - *Format & Genre Breakdown:* Donut chart for the current month's trends.
  - *Average Reading Speed:* Calculated pages read per hour.
- **Monthly Summary:** Auto-generated wrap-up at the end of each month showing books finished and total pages/hours.
- **Yearly Wrap-Up:**
  - Top favorite books, authors, and genres.
  - Reading habit analytics (e.g., "You read mostly on Sunday mornings").
  - Total hours read and pages turned.

---
*Generated for coding agent context based on the user's Reading Journal UI/UX specifications and technical requirements.*