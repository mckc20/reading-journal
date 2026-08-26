export type GenreMetadata = {
  name: string;
  description: string;
  accentClassName?: string;
};

export const genreMetadataBySlug: Record<string, GenreMetadata> = {
  fiction: {
    name: "Fiction",
    description: "Stories shaped by character, setting, conflict, and imagination.",
    accentClassName: "from-rose-500/25 via-amber-500/15 to-sky-500/20",
  },
  "non-fiction": {
    name: "Non-Fiction",
    description: "Books rooted in real people, events, ideas, research, and practical knowledge.",
    accentClassName: "from-emerald-500/25 via-cyan-500/15 to-slate-500/20",
  },
  "age-target": {
    name: "Age Target",
    description: "Reading age and audience labels that help you browse across genres.",
    accentClassName: "from-fuchsia-500/20 via-orange-500/15 to-lime-500/20",
  },
  fantasy: {
    name: "Fantasy",
    description: "Stories where magic, myth, invented worlds, or supernatural forces shape the plot.",
    accentClassName: "from-emerald-500/25 via-indigo-500/15 to-rose-500/20",
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
    accentClassName: "from-cyan-500/25 via-violet-500/15 to-amber-500/20",
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
        ? `Browse books filed under ${name} and any of its subgenres.`
        : `${name} is a read-only genre in your library. Books from this genre and its subgenres are grouped here.`,
    }
  );
}
