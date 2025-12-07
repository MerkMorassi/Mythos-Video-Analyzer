
export interface Agent {
  id: string;
  name: string;
  systemPrompt: string;
  voice: string;
  avatar?: string;
  tags?: string[];
  speakingRate?: number;
  autoPlayAudio?: boolean;
  knowledgeBaseUrl?: string;
  enableLocalRag?: boolean;
  protectedWords?: string;
}

const DEFAULT_AGENT: Agent = {
  id: 'project-agent-core',
  name: 'Kore',
  systemPrompt: 'You are a helpful AI Assistant who is an expert in cinematography, director of photography and SDXL prompt engineering optimization for filmmakers.',
  voice: 'Kore',
  speakingRate: 1.0,
  autoPlayAudio: false,
  enableLocalRag: true, // Enabled by default for the single agent
  tags: ['Cinematography', 'Direction', 'SDXL'],
  protectedWords: 'Kore, SDXL, Cinematography'
};

const AGENT_STORAGE_KEY = 'project-agent-v1';

export const getAvailableVoices = () => [
  { name: 'Kore', label: 'Kore (Calm & Clear)' },
  { name: 'Puck', label: 'Puck (Energetic & Youthful)' },
  { name: 'Charon', label: 'Charon (Deep & Authoritative)' },
  { name: 'Fenrir', label: 'Fenrir (Serious & Commanding)' },
  { name: 'Zephyr', label: 'Zephyr (Warm & Friendly)' },
];

export function getAgent(): Agent {
  try {
    const saved = localStorage.getItem(AGENT_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error("Failed to load agent from localStorage:", error);
  }
  // If no saved agent, save and return the default
  saveAgent(DEFAULT_AGENT);
  return DEFAULT_AGENT;
}

export function saveAgent(agent: Agent): void {
  try {
    localStorage.setItem(AGENT_STORAGE_KEY, JSON.stringify(agent));
  } catch (error) {
    console.error("Failed to save agent to localStorage:", error);
  }
}

export function resetAgentToDefault(): Agent {
  saveAgent(DEFAULT_AGENT);
  return DEFAULT_AGENT;
}