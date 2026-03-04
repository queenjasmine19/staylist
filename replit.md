# Overview

Staylist (formerly Room Service / Editour) is a luxury hotel curation and social platform, designed as a warm, editorial-styled web app. It allows users to log, browse, and share curated hotel stays globally. Key functionalities include creating, editing, and deleting hotel entries with details like name, city, rating (1–5 "Pearl" scale), amenities, date of stay, photos, and notes. The application features three main views: Collection (user's personal hotel entries), Destinations (a social network feed or city browser), and Wishlist. The project aims to become a leading platform for luxury travel enthusiasts, combining personal curation with social discovery and planning tools.

# User Preferences

Preferred communication style: Simple, everyday language.

## Key Accounts
- **Admin**: `jbacchus19@gmail.com` — full admin privileges (landing page editing, New Arrivals visibility, auto-follows all users)
- **Demo**: `82tram_rumbles@icloud.com` — demo account, no one except admin can follow it, but it can follow others

# System Architecture

## Monorepo Structure

The project employs a full-stack TypeScript monorepo pattern, divided into `client/` (React frontend), `server/` (Express backend), and `shared/` (common types, schemas, and API contracts).

## Authentication

Authentication is handled via Replit Auth using OpenID Connect (passport + express-session) with session storage in PostgreSQL. User-scoped content ensures logged-in users see their own data, while logged-out users view public seed data.

## Frontend (`client/`)

-   **Framework**: React 18 with TypeScript.
-   **Routing**: Wouter for client-side routing.
-   **State/Data Fetching**: TanStack React Query manages server state.
-   **UI Components**: Shadcn/ui built on Radix UI primitives.
-   **Styling**: Tailwind CSS with a "Modern Organic" neutral palette, custom CSS variables for theming, portrait-oriented cards with full-bleed images, dark gradient overlays, 32px rounded corners, pill-shaped ghost buttons, and distinct font families (Playfair Display for headings/buttons, Inter for body, Space Mono for labels).
-   **Animations**: Framer Motion for smooth transitions.
-   **Build**: Vite handles the build process, outputting to `dist/public`.

### Key Pages and Features
-   **Landing Page** (`/`): Public-facing entry point with hero section, email sign-up bar, three pillars, and "How It Works" instructional Z-pattern section. Admin users see "Change Photo" overlays on all four images (hero + 3 steps) to customize the landing page visuals via `siteSettings` table.
-   **Collection** (`/app`): Social profile view with "MY COLLECTION" header, social stats bar (Followers with face-pile avatars, Following, Stays counts), drag-to-reorder, editing, and deletion capabilities. Navigation label: "My Collection" in serif font.
-   **My Network** (`/map`): Social network feed of followed users' stays when authenticated, otherwise functions as a city-grouped browser. PearlsRating includes hover tooltip and optional caption explaining the 1-5 scale.
-   **Itinerary** (`/itinerary`): Standalone trip planner page with a two-column layout — 65% timeline (left) and 35% sticky "The Style Match" sidebar (right). Day blocks have dedicated drop zones for Hotel Stay, Dining, Wellness, and Attractions. Users drag recommendations from the sidebar into day slots using HTML5 drag-and-drop. Sidebar shows network-vetted style matches with friend avatar face-piles, AI-powered hotel recommendations (OpenAI, priority: network > style > collective), AI dining/wellness experience suggestions — all filtered to the focused day's city, a **Workspace** section for saving any place (restaurants, attractions, wellness, etc.) via Google Places search that can be dragged into days later, and the user's collection. Itinerary items have inline time-of-day editing. Pencil icons enable inline text editing for notes. Auto-fills remaining days when assigning Day 1 on trips under 5 days.
-   **Wishlist**: A private section for saving hotels, with automated Unsplash image fetching. Includes "Common Ground" tab showing mutual wishlist matches with friends (fuzzy slug matching for hotel name variants). Toggle between "My Wishlist" and "Common Ground" views.
-   **User Collection** (`/users/:id`): View another user's hotel stays. Hotel detail modals show "Vetted by @name" badge and "Plan Trip" button with "+ Create New Trip" inline form (creates trip, adds hotel as Day 1 with `vettedByUserId`, navigates to Trip Planner).
-   **Profile**: Allows users to manage first/last name, upload avatars, and view email.

## Backend (`server/`)

-   **Framework**: Express 5 on Node.js.
-   **API Pattern**: RESTful JSON API under the `/api/` prefix.
-   **Database**: PostgreSQL managed via `pg` Pool and Drizzle ORM.
-   **Development**: `tsx` for development with Vite middleware for HMR.
-   **Production**: `esbuild` for compilation, serving static files from `dist/public`.

### API Endpoints
Provides comprehensive CRUD operations for hotels, wishlist items, user profiles, social features (follows, network feed), and trip planning. Includes endpoints for authentication, AI recommendations (POST /api/trips/recommendations with `cities` and `includeExperiences` params, returns `{recommendations, experiences}` with priority ranking), searching users, and style-match scoring (GET /api/trips/:id/style-matches).

## Shared Layer (`shared/`)

Contains `schema.ts` for Drizzle table definitions and Zod validation schemas, `models/auth.ts` for auth-specific schemas, and `routes.ts` for API contract definitions and request/response validation.

### Database Schema
Key tables include `hotels` (for curated stays with `imageUrl` for user-uploaded photos, `googlePhotoUrl` for Google Places professional photos, `majorCity` and `suburb` for city mapping, and 13 boolean amenity columns: `hasSpa`, `hasConcierge`, `hasGym`, `hasPool`, `hasRestaurant`, `hasMichelinGuide` (Michelin Key), `hasMichelinStar` (Michelin Star), `hasForbesTravelGuide`, `hasOceanView`, `hasCocktailBar`, `hasDesignForward`, `hasLateNightDining`, `hasRooftop`. When a hotel is selected via Google Places, the app auto-detects Michelin Key, Michelin Star, and Forbes Travel Guide status using OpenAI (POST /api/hotels/check-awards, cached 24hr)), `wishlist` (same dual-image and city mapping pattern), `follows` (for social connections), `tripPlans` (with `totalDays` for day-by-day planning, optional `startDate` for calendar date display on each day), `tripDays` (one hotel assignment per day number, also with `majorCity`/`suburb`, `googlePhotoUrl` for persistent Style Match photos, `vettedByUserId` for tracking which friend recommended the hotel), `tripItineraryItems` (dining/wellness/attraction items per day with Google Maps links, `placeId` and `googlePhotoUrl` for Google Places integration, `timeOfDay` for reservation times), `tripWorkspaceItems` (per-trip scratch pad for saved places not yet assigned to a day, with `placeId`, `googlePhotoUrl`, `imageUrl`, `category` (Shopping/Wellness/Dining/Attraction/Cocktail Bar), `neighborhood` from Google Places suburb, draggable into day slots), `users` (for authentication and profiles), `sessions` (for session management), and `siteSettings` (key-value pairs for admin-configurable landing page images).

### Major City Mapper
When a hotel is added via Google Places, the system extracts address components. `locality` is always preferred as `majorCity` (the recognizable city name like "Sydney"), with `sublocality` used as `suburb` (neighborhood like "Redfern"). When `locality` is absent and `administrative_area_level_1` was cleaned (stripped suffixes like Governorate, Prefecture, Province, etc.), the cleaned admin_level_1 becomes `majorCity` and `administrative_area_level_2` becomes `suburb` (e.g., Cairo Governorate → majorCity "Cairo", Zamalek → suburb "Zamalek"; Tokyo Prefecture → majorCity "Tokyo", Shibuya → suburb "Shibuya"). Otherwise falls back to `administrative_area_level_2` then `administrative_area_level_1`. `cleanAdminName()` strips suffixes (Governorate, Prefecture, Province, Region, District, Municipality, Department, Oblast, County, State) and prefixes (City of, Council of the City of). All city grouping (CityBrowser sidebar, FollowSidebar, Trip Planner city filtering) uses `majorCity` as the primary label. Suburb details appear in hotel card detail views as "Located in {suburb}". Existing data without majorCity falls back to the `city` field. Trip Planner city filtering matches both `majorCity` and `city` to include all mapped suburbs.

### Image Display Priority
All card displays (Collection, Destinations, Wishlist, Trip Planner) follow the priority: user-uploaded `imageUrl` first, then `googlePhotoUrl` from Google Places as fallback.

# External Dependencies

## Database
-   **PostgreSQL**: Primary data store.
-   **Drizzle ORM**: Type-safe query builder.

## Key NPM Packages
-   **Express 5**: HTTP server.
-   **Vite**: Frontend build tool.
-   **React 18**: UI framework.
-   **TanStack React Query**: Server state management.
-   **Radix UI**: Headless UI components.
-   **Framer Motion**: Animation library.
-   **Zod**: Runtime schema validation.
-   **Wouter**: Client-side router.
-   **Tailwind CSS**: Utility-first CSS.
-   **Passport + openid-client**: OpenID Connect authentication.
-   **express-session + connect-pg-simple**: Session management.

## External Services
-   **Google Fonts**: For custom typography.
-   **Unsplash**: Provides images for wishlist items.
-   **Google Places API (New)**: Server-side proxy (`/api/places/autocomplete`, `/api/places/details/:placeId`, `/api/places/photo-lookup`) for hotel search autocomplete and photo retrieval. Uses Places API v1. Photo-lookup endpoint has in-memory server-side caching (1hr TTL). Hotels, wishlist items, and trip days now store `placeId`, `country`, `majorCity`, and `suburb` for normalized matching and city mapping. Common Ground uses placeId-first matching with matchSlug fallback for legacy data.
-   **Replit Auth**: OpenID Connect provider.
-   **OpenAI**: For AI hotel recommendations.