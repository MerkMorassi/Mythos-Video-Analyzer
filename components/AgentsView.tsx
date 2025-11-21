
import React, { useState } from 'react';
import { Agent } from '../services/agentService';
import { AgentForm } from './AgentForm';
import { PlusIcon } from './icons/PlusIcon';
import { PencilIcon } from './icons/PencilIcon';
import { TrashIcon } from './icons/TrashIcon';
import { UserIcon } from './icons/UserIcon';
import { CopyIcon } from './icons/CopyIcon';

interface AgentsViewProps {
  agents: Agent[];
  onSaveAgent: (agent: Omit<Agent, 'id' | 'isCustom'> & { id?: string }) => void;
  onDeleteAgent: (agentId: string) => void;
  defaultAgentId: string | null;
  onSetDefaultAgent: (agentId: string) => void;
}

export const AgentsView: React.FC<AgentsViewProps> = ({ agents, onSaveAgent, onDeleteAgent, defaultAgentId, onSetDefaultAgent }) => {
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  const handleCreateNew = () => {
    setEditingAgent(null);
    setIsFormVisible(true);
  };

  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setIsFormVisible(true);
  };

  const handleCustomize = (agent: Agent) => {
    // Clone the agent settings but clear the ID to treat it as a new creation
    const customAgent = {
        ...agent,
        id: '', // Empty ID signals creation of a new agent on save
        name: `${agent.name} (Custom)`,
        isCustom: true
    };
    setEditingAgent(customAgent as Agent);
    setIsFormVisible(true);
  };

  const handleSave = (agent: Omit<Agent, 'id' | 'isCustom'> & { id?: string }) => {
    onSaveAgent(agent);
    setIsFormVisible(false);
    setEditingAgent(null);
  };

  const handleDelete = (agentId: string) => {
    if (window.confirm("Are you sure you want to delete this agent?")) {
      onDeleteAgent(agentId);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Manage Agents</h2>
          <p className="text-text-secondary">Create custom personas or customize default experts with your own RAG data.</p>
        </div>
        <button
          onClick={handleCreateNew}
          className="flex items-center gap-2 px-4 py-2 bg-brand text-text-primary rounded-lg hover:bg-brand-hover transition-colors shadow-md"
        >
          <PlusIcon className="w-5 h-5" />
          Create New Agent
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map(agent => (
          <div key={agent.id} className="bg-secondary border border-accent rounded-lg p-4 flex flex-col justify-between min-h-[160px] transition-all hover:border-brand/50 hover:shadow-md">
            <div className="flex-grow">
              <div className="flex items-start gap-3 mb-2">
                {agent.avatar ? (
                  <img src={agent.avatar} alt={agent.name} className="w-10 h-10 rounded-full object-cover bg-accent flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                    <UserIcon className="w-6 h-6 text-text-secondary"/>
                  </div>
                )}
                <div className="flex-grow">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="font-bold text-lg text-text-primary leading-tight">{agent.name}</h3>
                            <p className={`text-xs font-semibold uppercase mt-1 ${agent.isCustom ? 'text-brand-hover' : 'text-text-secondary'}`}>
                                {agent.isCustom ? 'Custom Agent' : 'Default Voice'}
                            </p>
                        </div>
                        {agent.id === defaultAgentId && (
                            <span className="text-xs font-bold bg-brand text-text-primary px-2 py-1 rounded-full ml-2 whitespace-nowrap">✓ Default</span>
                        )}
                    </div>
                </div>
              </div>
              {agent.systemPrompt && (
                <div className="text-sm text-text-secondary mt-3 p-2 bg-primary/50 rounded max-h-24 overflow-y-auto italic relative group">
                  <p className="whitespace-pre-wrap line-clamp-3 group-hover:line-clamp-none transition-all">"{agent.systemPrompt}"</p>
                </div>
              )}
               {agent.tags && agent.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {agent.tags.map(tag => (
                    <span key={tag} className="px-2 py-1 text-xs bg-accent/50 border border-accent rounded-full text-text-secondary">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            
            <div className="space-y-2 mt-4 pt-3 border-t border-accent">
               {agent.knowledgeBaseUrl && (
                <div className="pb-2 text-left">
                  <p className="text-xs font-semibold uppercase text-text-secondary/70 tracking-wider flex items-center gap-1">
                    Knowledge Base (RAG)
                  </p>
                  <p className="text-sm font-medium text-brand-hover mt-1 truncate hover:whitespace-normal break-all bg-primary/30 p-1 rounded px-2">
                    {agent.knowledgeBaseUrl}
                  </p>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs font-semibold uppercase text-text-secondary/70 tracking-wider">Voice</p>
                  <p className="text-sm font-medium text-text-primary mt-1 truncate" title={agent.voice}>{agent.voice}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-text-secondary/70 tracking-wider">Rate</p>
                  <p className="text-sm font-medium text-text-primary mt-1">{agent.speakingRate?.toFixed(1) ?? '1.0'}x</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-text-secondary/70 tracking-wider">Auto-Play</p>
                  <p className="text-sm font-medium text-text-primary mt-1">{agent.autoPlayAudio ? 'On' : 'Off'}</p>
                </div>
              </div>
              
              <div className="flex justify-between items-center pt-3 gap-2">
                 {agent.id !== defaultAgentId ? (
                    <button 
                        onClick={() => onSetDefaultAgent(agent.id)} 
                        className="px-3 py-1.5 text-xs font-semibold bg-primary border border-accent text-text-secondary hover:bg-accent hover:text-text-primary rounded-md transition-colors flex-grow text-center"
                    >
                        Set as Default
                    </button>
                 ) : <div className="flex-grow"></div>}

                 <div className="flex gap-1">
                     {agent.isCustom ? (
                        <>
                            <button 
                                onClick={() => handleEdit(agent)} 
                                className="p-2 text-text-secondary hover:text-white hover:bg-accent rounded-md transition-colors" 
                                title="Edit Agent"
                            >
                                <PencilIcon className="w-4 h-4" />
                            </button>
                            <button 
                                onClick={() => handleDelete(agent.id)} 
                                className="p-2 text-text-secondary hover:text-red-400 hover:bg-red-900/20 rounded-md transition-colors" 
                                title="Delete Agent"
                            >
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        </>
                    ) : (
                        <button 
                            onClick={() => handleCustomize(agent)} 
                            className="p-2 text-text-secondary hover:text-brand-hover hover:bg-accent rounded-md transition-colors" 
                            title="Customize & Clone this Agent"
                        >
                             <CopyIcon className="w-4 h-4" />
                        </button>
                    )}
                 </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isFormVisible && (
        <AgentForm
          agent={editingAgent}
          onSave={handleSave}
          onCancel={() => setIsFormVisible(false)}
        />
      )}
    </div>
  );
};
