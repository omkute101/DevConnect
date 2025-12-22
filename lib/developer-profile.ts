// Developer profile types and utilities

export interface TechStack {
  name: string
  category: "language" | "framework" | "database" | "tool" | "cloud"
}

export const TECH_STACKS: TechStack[] = [
  // Languages
  { name: "TypeScript", category: "language" },
  { name: "JavaScript", category: "language" },
  { name: "Python", category: "language" },
  { name: "Go", category: "language" },
  { name: "Rust", category: "language" },
  { name: "Java", category: "language" },
  { name: "C++", category: "language" },
  { name: "Swift", category: "language" },
  { name: "Kotlin", category: "language" },

  // Frameworks
  { name: "React", category: "framework" },
  { name: "Next.js", category: "framework" },
  { name: "Vue", category: "framework" },
  { name: "Svelte", category: "framework" },
  { name: "Angular", category: "framework" },
  { name: "Node.js", category: "framework" },
  { name: "Django", category: "framework" },
  { name: "FastAPI", category: "framework" },
  { name: "Express", category: "framework" },
  { name: "Rails", category: "framework" },

  // Databases
  { name: "PostgreSQL", category: "database" },
  { name: "MongoDB", category: "database" },
  { name: "Redis", category: "database" },
  { name: "MySQL", category: "database" },
  { name: "Supabase", category: "database" },

  // Tools
  { name: "Docker", category: "tool" },
  { name: "Git", category: "tool" },
  { name: "GraphQL", category: "tool" },
  { name: "Tailwind", category: "tool" },

  // Cloud
  { name: "AWS", category: "cloud" },
  { name: "Vercel", category: "cloud" },
  { name: "GCP", category: "cloud" },
  { name: "Azure", category: "cloud" },
]

export interface DeveloperProfile {
  id: string
  displayName?: string
  isAnonymous: boolean
  github?: string
  linkedin?: string
  website?: string
  techStack: string[]
  currentProject?: string
  lookingFor?: string
  experience?: "junior" | "mid" | "senior" | "lead"
}

export function createEmptyProfile(id: string): DeveloperProfile {
  return {
    id,
    isAnonymous: true,
    techStack: [],
  }
}

export function validateGitHubUrl(url: string): boolean {
  if (!url) return true // Empty is valid (optional)
  const pattern = /^https?:\/\/(www\.)?github\.com\/[\w-]+\/?$/i
  return pattern.test(url)
}

export function validateLinkedInUrl(url: string): boolean {
  if (!url) return true
  const pattern = /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?$/i
  return pattern.test(url)
}

export function validateWebsiteUrl(url: string): boolean {
  if (!url) return true
  const pattern = /^https?:\/\/.+/i
  return pattern.test(url)
}
