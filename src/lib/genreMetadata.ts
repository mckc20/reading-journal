import {
  Backpack, BookOpen, BookOpenText, BookUser, Brain, Building2, Calculator,
  CalendarDays, ChartNoAxesCombined, CookingPot, Crown, Feather, Fingerprint,
  FlaskConical, Ghost, GraduationCap, HatGlasses, Heart, HeartPulse, Hourglass,
  Landmark, Laugh, Leaf, Mail, Map, Megaphone, Microscope, NotebookPen, Orbit,
  Palette, PanelsTopLeft, Rocket, Skull, Sparkles, Sprout, Swords, Telescope,
  ToyBrick, User, UserRound, Zap, type LucideIcon,
} from "lucide-react";

export type GenreMetadata = {
  name: string;
  description: string;
};

// Explicit imports keep the genre-to-icon choices easy to review and allow tree shaking.
const genreIcons: Record<string, LucideIcon> = {
  // Fiction
  "action-adventure": Zap,
  "contemporary-fiction": CalendarDays,
  epistolary: Mail,
  fantasy: Sparkles,
  "epic-fantasy": Swords,
  "high-fantasy": Crown,
  "urban-fantasy": Building2,
  "historical-fiction": Hourglass,
  horror: Skull,
  "humor-satire": Laugh,
  "literary-fiction": Feather,
  "mystery-crime": HatGlasses,
  romance: Heart,
  "science-fiction": Orbit,
  dystopian: PanelsTopLeft,
  "hard-sci-fi": Microscope,
  "space-opera": Rocket,
  "short-stories": BookOpenText,
  "thriller-suspense": Ghost,
  // Non-fiction
  "art-photography-design": Palette,
  "biography-memoir": BookUser,
  "business-economics": ChartNoAxesCombined,
  "cookbooks-food": CookingPot,
  "essays-anthologies": NotebookPen,
  "health-wellness": HeartPulse,
  history: Landmark,
  "philosophy-spirituality": Brain,
  "politics-current-events": Megaphone,
  "science-technology": FlaskConical,
  mathematics: Calculator,
  "nature-environment": Leaf,
  "popular-science": Telescope,
  "self-help-personal-development": Sprout,
  travel: Map,
  "true-crime": Fingerprint,
  // Reading audiences
  adult: UserRound,
  childrens: ToyBrick,
  "middle-grade": Backpack,
  "new-adult": GraduationCap,
  "young-adult": User,
};

type GenreAccent = "book" | "castle" | "orbit" | "heart" | "search" | "feather" | "landmark" | "leaf" | "compass" | "sparkles";

const genreAccentGroups: Record<string, GenreAccent> = {
  fiction: "book", "non-fiction": "feather", "age-target": "heart",
  fantasy: "castle", "science-fiction": "orbit", romance: "heart",
  "epic-fantasy": "castle", "high-fantasy": "castle", "urban-fantasy": "castle",
  dystopian: "orbit", "hard-sci-fi": "orbit", "space-opera": "orbit", mathematics: "orbit",
  epistolary: "feather", "short-stories": "feather",
  "mystery-crime": "search", "thriller-suspense": "search", horror: "sparkles",
  "historical-fiction": "landmark", "literary-fiction": "feather",
  "contemporary-fiction": "feather", "action-adventure": "compass", "humor-satire": "sparkles",
  "biography-memoir": "feather", history: "landmark", "true-crime": "search",
  "politics-current-events": "landmark", "self-help-personal-development": "leaf",
  "business-economics": "landmark", "science-technology": "orbit", "popular-science": "orbit",
  "nature-environment": "leaf", "philosophy-spirituality": "sparkles", "health-wellness": "leaf",
  travel: "compass", "cookbooks-food": "leaf", "art-photography-design": "feather", "essays-anthologies": "feather",
  adult: "book", childrens: "feather", "middle-grade": "compass", "new-adult": "heart", "young-adult": "orbit",
};

/** Keep accents quiet enough that the user's covers remain the main visual. */
export function getGenreArtwork(slug: string) {
  const accent = genreAccentGroups[slug] ?? "book";
  const accents: Record<GenreAccent, string> = {
    book: "from-[#a6ad96]/30 via-[#a6ad96]/15 to-[#d5bd9d]/15",
    castle: "from-[#90aa96]/30 via-[#90aa96]/15 to-[#d5bd9d]/15",
    orbit: "from-[#b2a4c5]/30 via-[#b2a4c5]/15 to-[#b9cbd0]/15",
    heart: "from-[#c8969e]/30 via-[#c8969e]/15 to-[#d5bd9d]/15",
    search: "from-[#a5a3af]/30 via-[#a5a3af]/15 to-[#c7b7cb]/15",
    feather: "from-[#c7a16f]/30 via-[#c7a16f]/15 to-[#d9b5b2]/15",
    landmark: "from-[#c69b82]/30 via-[#c69b82]/15 to-[#d5bd9d]/15",
    leaf: "from-[#9fac82]/30 via-[#9fac82]/15 to-[#d5bd9d]/15",
    compass: "from-[#92acb8]/30 via-[#92acb8]/15 to-[#b9c8af]/15",
    sparkles: "from-[#b7a0bc]/30 via-[#b7a0bc]/15 to-[#d9b5b2]/15",
  };
  const iconColors: Record<GenreAccent, string> = {
    book: "text-[#a6ad96] dark:text-[#c0c7af]",
    castle: "text-[#90aa96] dark:text-[#aec4b1]",
    orbit: "text-[#b2a4c5] dark:text-[#c0b2d3]",
    heart: "text-[#c8969e] dark:text-[#deb0b5]",
    search: "text-[#a5a3af] dark:text-[#bebbc6]",
    feather: "text-[#c7a16f] dark:text-[#dfbe91]",
    landmark: "text-[#c69b82] dark:text-[#deb79e]",
    leaf: "text-[#9fac82] dark:text-[#bac79e]",
    compass: "text-[#92acb8] dark:text-[#b0c7d1]",
    sparkles: "text-[#b7a0bc] dark:text-[#ccb3cf]",
  };
  return {
    illustration: genreIcons[slug] ?? BookOpen,
    accentClassName: accents[accent],
    iconClassName: iconColors[accent],
  };
}

export const genreMetadataBySlug: Record<string, GenreMetadata> = {
  fiction: {
    name: "Fiction",
    description: "Stories shaped by character, setting, conflict, and imagination.",
  },
  "non-fiction": {
    name: "Non-Fiction",
    description: "Books rooted in real people, events, ideas, research, and practical knowledge.",
  },
  "age-target": {
    name: "Age Target",
    description: "Reading age and audience labels that help you browse across genres.",
  },
  fantasy: {
    name: "Fantasy",
    description: "Stories where magic, myth, invented worlds, or supernatural forces shape the plot.",
  },
  "high-fantasy": {
    name: "High Fantasy",
    description: "Fantasy set in secondary worlds, often with large stakes, deep lore, and heroic arcs.",
  },
  "epic-fantasy": {
    name: "Epic Fantasy",
    description: "Broad fantasy stories with sweeping conflicts, ensemble casts, and long-form journeys.",
  },
  "urban-fantasy": {
    name: "Urban Fantasy",
    description: "Magic and supernatural elements woven into modern city life.",
  },
  "science-fiction": {
    name: "Science Fiction",
    description: "Speculative stories built around science, technology, space, time, or future societies.",
  },
  "space-opera": {
    name: "Space Opera",
    description: "Large-scale science fiction with star-spanning adventure, politics, and drama.",
  },
  dystopian: {
    name: "Dystopian",
    description: "Speculative societies shaped by oppression, collapse, control, or survival.",
  },
  "hard-sci-fi": {
    name: "Hard Sci-Fi",
    description: "Science fiction that leans on technical plausibility and scientific detail.",
  },
  romance: {
    name: "Romance",
    description: "Stories centered on relationships, emotional stakes, and a romantic arc.",
  },
  "mystery-crime": {
    name: "Mystery & Crime",
    description: "Investigations, puzzles, criminal cases, and the search for truth.",
  },
  "thriller-suspense": {
    name: "Thriller & Suspense",
    description: "Fast-moving stories built around danger, tension, secrets, and high stakes.",
  },
  horror: {
    name: "Horror",
    description: "Stories designed around fear, dread, monsters, the uncanny, or psychological unease.",
  },
  "historical-fiction": {
    name: "Historical Fiction",
    description: "Fiction set in the past, blending invented lives with historical context.",
  },
  "literary-fiction": {
    name: "Literary Fiction",
    description: "Character-focused fiction with strong attention to style, theme, and interior life.",
  },
  "contemporary-fiction": {
    name: "Contemporary Fiction",
    description: "Fiction set close to the present day, often focused on modern relationships and society.",
  },
  "action-adventure": {
    name: "Action & Adventure",
    description: "Plot-driven stories with quests, danger, movement, and physical stakes.",
  },
  "humor-satire": {
    name: "Humor & Satire",
    description: "Books that use wit, comedy, irony, or exaggeration to entertain or critique.",
  },
  "biography-memoir": {
    name: "Biography & Memoir",
    description: "Life stories, personal histories, and accounts of real people.",
  },
  history: {
    name: "History",
    description: "Books about past events, cultures, movements, and the forces that shaped them.",
  },
  "true-crime": {
    name: "True Crime",
    description: "Real criminal cases, investigations, legal stories, and social context.",
  },
  "politics-current-events": {
    name: "Politics & Current Events",
    description: "Books about power, policy, public life, institutions, and recent events.",
  },
  "self-help-personal-development": {
    name: "Self-Help & Personal Development",
    description: "Practical books for habits, growth, productivity, reflection, and life skills.",
  },
  "business-economics": {
    name: "Business & Economics",
    description: "Markets, organizations, money, work, leadership, and economic systems.",
  },
  "science-technology": {
    name: "Science & Technology",
    description: "Books explaining scientific fields, technical change, and how the world works.",
  },
  "popular-science": {
    name: "Popular Science",
    description: "Accessible science writing for curious readers outside specialist fields.",
  },
  "nature-environment": {
    name: "Nature & Environment",
    description: "Books about ecosystems, climate, natural history, conservation, and our planet.",
  },
  "philosophy-spirituality": {
    name: "Philosophy & Spirituality",
    description: "Questions of meaning, ethics, belief, consciousness, and how to live.",
  },
  "health-wellness": {
    name: "Health & Wellness",
    description: "Physical health, mental wellbeing, fitness, medicine, and sustainable care.",
  },
  travel: {
    name: "Travel",
    description: "Places, journeys, cultures, travel writing, and ways of seeing the world.",
  },
  "cookbooks-food": {
    name: "Cookbooks & Food",
    description: "Recipes, food culture, cooking skills, ingredients, and culinary history.",
  },
  "art-photography-design": {
    name: "Art, Photography & Design",
    description: "Visual culture, creative practice, images, objects, spaces, and design thinking.",
  },
  "essays-anthologies": {
    name: "Essays & Anthologies",
    description: "Collected shorter works, themed selections, and reflective nonfiction pieces.",
  },
  childrens: {
    name: "Children's",
    description: "Books created for younger readers, from early stories to chapter books.",
  },
  "middle-grade": {
    name: "Middle Grade",
    description: "Books often written for readers roughly 8 to 12, with age-appropriate adventure and themes.",
  },
  "young-adult": {
    name: "Young Adult",
    description: "Books centered on teen perspectives, coming-of-age stakes, and identity.",
  },
  "new-adult": {
    name: "New Adult",
    description: "Books focused on early adulthood, independence, relationships, and transition.",
  },
  adult: {
    name: "Adult",
    description: "Books written primarily for adult readers.",
  },
};

export function getGenreMetadata(slug: string, name: string, isSystem: boolean): GenreMetadata {
  return (
    genreMetadataBySlug[slug] ?? {
      name,
      description: isSystem
        ? `Discover the stories and ideas in your ${name} collection.`
        : `A collection of books you've brought together under ${name}.`,
    }
  );
}
