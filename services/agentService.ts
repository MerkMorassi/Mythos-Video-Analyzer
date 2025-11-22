
export interface Agent {
  id: string;
  name: string;
  systemPrompt: string;
  voice: string;
  isCustom: boolean; // Retained to potentially style user-created agents differently if needed, but logic is unified.
  avatar?: string;
  tags?: string[];
  speakingRate?: number;
  autoPlayAudio?: boolean;
  knowledgeBaseUrl?: string;
}

const DEFAULT_VOICES = [
  { 
    name: 'Kore', 
    label: 'Kore (Calm & Clear)',
    systemPrompt: 'You are a helpful AI Assistant who is an expert in cinematography, director of photography and SDXL prompt engineering optimization for filmmakers.'
  },
  { name: 'Puck', label: 'Puck (Energetic & Youthful)', systemPrompt: 'You are a helpful and energetic AI assistant.' },
  { name: 'Charon', label: 'Charon (Deep & Authoritative)', systemPrompt: 'You are a knowledgeable AI assistant with a deep, authoritative voice.' },
  { name: 'Fenrir', label: 'Fenrir (Serious & Commanding)', systemPrompt: 'You are a serious and commanding AI assistant.' },
  { name: 'Zephyr', label: 'Zephyr (Warm & Friendly)', systemPrompt: 'You are a warm and friendly AI assistant.' },
];

const createDefaultAgents = (): Agent[] => DEFAULT_VOICES.map(voice => ({
  id: `default-${voice.name}`,
  name: voice.label,
  systemPrompt: voice.systemPrompt,
  voice: voice.name,
  isCustom: false,
  speakingRate: 1.0,
  autoPlayAudio: false,
}));

const AGENTS_STORAGE_KEY = 'agents-v2'; // Renamed to avoid conflicts with old structure
const DEFAULT_AGENT_STORAGE_KEY = 'default-agent-id';


function loadAgentsFromStorage(): Agent[] {
  try {
    const savedAgents = localStorage.getItem(AGENTS_STORAGE_KEY);
    return savedAgents ? JSON.parse(savedAgents) : [];
  } catch (error) {
    console.error("Failed to load agents from localStorage:", error);
    return [];
  }
}

function saveAgentsToStorage(agents: Agent[]): void {
  try {
    localStorage.setItem(AGENTS_STORAGE_KEY, JSON.stringify(agents));
  } catch (error) {
    console.error("Failed to save agents to localStorage:", error);
  }
}

export function getAgents(): Agent[] {
  let agents = loadAgentsFromStorage();
  if (agents.length === 0) {
    // First time load or after a reset, populate with defaults
    agents = createDefaultAgents();
    saveAgentsToStorage(agents);
  }
  return agents;
}

export function saveAgent(agent: Omit<Agent, 'isCustom'> & { id?: string }): Agent {
  const allAgents = getAgents();
  const isNew = !agent.id;

  const newAgentData: Agent = {
    ...agent,
    id: agent.id || `custom-${crypto.randomUUID()}`,
    isCustom: true, // Mark new or edited agents as custom
  };

  if (isNew) {
    allAgents.push(newAgentData);
  } else {
    const existingIndex = allAgents.findIndex(a => a.id === newAgentData.id);
    if (existingIndex !== -1) {
      allAgents[existingIndex] = newAgentData;
    } else {
      allAgents.push(newAgentData); // Should not happen with UUIDs but is safe
    }
  }
  
  saveAgentsToStorage(allAgents);
  return newAgentData;
}

export function deleteAgent(agentId: string): void {
  let allAgents = getAgents();
  allAgents = allAgents.filter(a => a.id !== agentId);
  saveAgentsToStorage(allAgents);
}

export function resetAgentsToDefault(): Agent[] {
    const defaultAgents = createDefaultAgents();
    saveAgentsToStorage(defaultAgents);
    // Reset default agent ID as well
    if(defaultAgents.length > 0) {
        setDefaultAgentId(defaultAgents[0].id);
    } else {
        localStorage.removeItem(DEFAULT_AGENT_STORAGE_KEY);
    }
    return defaultAgents;
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
