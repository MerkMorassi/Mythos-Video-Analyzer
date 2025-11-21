
export interface Agent {
  id: string;
  name: string;
  systemPrompt: string;
  voice: string;
  isCustom: boolean;
  avatar?: string;
  tags?: string[];
  speakingRate?: number;
  autoPlayAudio?: boolean;
  knowledgeBaseUrl?: string;
}

const DEFAULT_VOICES = [
  { name: 'Kore', label: 'Kore (Calm & Clear)' },
  { name: 'Puck', label: 'Puck (Energetic & Youthful)' },
  { name: 'Charon', label: 'Charon (Deep & Authoritative)' },
  { name: 'Fenrir', label: 'Fenrir (Serious & Commanding)' },
  { name: 'Zephyr', label: 'Zephyr (Warm & Friendly)' },
];

const defaultAgents: Agent[] = DEFAULT_VOICES.map(voice => ({
  id: `default-${voice.name}`,
  name: voice.label,
  systemPrompt: '',
  voice: voice.name,
  isCustom: false,
  speakingRate: 1.0,
  autoPlayAudio: false,
}));

const STORAGE_KEY = 'custom-agents';
const DEFAULT_AGENT_STORAGE_KEY = 'default-agent-id';

function getCustomAgents(): Agent[] {
  try {
    const savedAgents = localStorage.getItem(STORAGE_KEY);
    return savedAgents ? JSON.parse(savedAgents) : [];
  } catch (error) {
    console.error("Failed to load custom agents from localStorage:", error);
    return [];
  }
}

export function getAgents(): Agent[] {
  const customAgents = getCustomAgents();
  return [...defaultAgents, ...customAgents];
}

export function saveAgent(agent: Omit<Agent, 'id' | 'isCustom'> & { id?: string }): Agent {
  const customAgents = getCustomAgents();
  const newAgent: Agent = {
    ...agent,
    id: agent.id || `custom-${crypto.randomUUID()}`,
    isCustom: true,
  };

  const existingIndex = customAgents.findIndex(a => a.id === newAgent.id);
  if (existingIndex !== -1) {
    customAgents[existingIndex] = newAgent;
  } else {
    customAgents.push(newAgent);
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customAgents));
  } catch (error) {
    console.error("Failed to save custom agents to localStorage:", error);
  }
  return newAgent;
}

export function deleteAgent(agentId: string): void {
  let customAgents = getCustomAgents();
  customAgents = customAgents.filter(a => a.id !== agentId);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customAgents));
  } catch (error) {
    console.error("Failed to delete agent from localStorage:", error);
  }
}

export const getAvailableVoices = () => DEFAULT_VOICES;

// Functions for managing the default agent
export function setDefaultAgentId(agentId: string): void {
    try {
        localStorage.setItem(DEFAULT_AGENT_STORAGE_KEY, agentId);
    } catch (error) {
        console.error("Failed to set default agent in localStorage:", error);
    }
}

export function getDefaultAgentId(): string | null {
    try {
        return localStorage.getItem(DEFAULT_AGENT_STORAGE_KEY);
    } catch (error) {
        console.error("Failed to get default agent from localStorage:", error);
        return null;
    }
}
