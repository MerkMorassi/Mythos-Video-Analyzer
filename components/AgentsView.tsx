import React, { useState } from 'react';
import { Agent } from '../services/agentService';
import { AgentForm } from './AgentForm';
import { PlusIcon } from './icons/PlusIcon';
import { PencilIcon } from './icons/PencilIcon';
import { TrashIcon } from './icons/TrashIcon';
import { UserIcon } from './icons/UserIcon';
import { DatabaseIcon } from './icons/DatabaseIcon';
import { SpeakerIcon } from './icons/SpeakerIcon';


interface AgentsViewProps {
  agents: Agent[];
  onSaveAgent: (agent: Omit<Agent, 'id' | 'isCustom'> & { id?: string }) => void;
  onDeleteAgent: (agentId: string) => void;
  defaultAgentId: string | null;
  onSetDefaultAgent: (agentId: string) => void;
  onResetAgents: () => void;
}

const AgentCard: React.FC<{agent: Agent, isDefault: boolean, onSetDefault: () => void, onEdit: () => void, onDelete: () => void}> = ({ agent, isDefault, onSetDefault, onEdit, onDelete }) => (
    <div className="bg-secondary border border-accent rounded-xl p-4 flex flex-col justify-between transition-all hover:border-brand/50 hover:shadow-lg relative">
        {isDefault && (
            <div className="absolute top-3 right-3 text-xs font-bold bg-brand text-text-primary px-2 py-0.5 rounded-full">✓ Default</div>
        )}
        {/* Top Section */}
        <div className="flex items-start gap-4">
            {agent.avatar ? (
                <img src={agent.avatar} alt={agent.name} className="w-12 h-12 rounded-full object-cover bg-accent flex-shrink-0" />
            ) : (
                <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                    <UserIcon className="w-7 h-7 text-text-secondary"/>
                </div>
            )}
            <div className="flex-grow min-w-0">
                <h3 className="font-bold text-lg text-text-primary leading-tight truncate">{agent.name}</h3>
                <p className="text-xs text-text-secondary mt-1">
                    {agent.tags?.join(', ') || 'No tags'}
                </p>
            </div>
        </div>

        {/* System Prompt */}
        <div className="text-sm text-text-secondary mt-3 p-2 bg-primary/50 rounded-lg overflow-y-auto italic h-20">
            {agent.systemPrompt ? (
            <p className="whitespace-pre-wrap">"{agent.systemPrompt}"</p>
            ) : (
            <span className="text-text-secondary/50">No system prompt defined.</span>
            )}
        </div>

        {/* Details */}
        <div className="space-y-2 mt-3 pt-3 border-t border-accent text-xs">
            <div className="flex items-center gap-2 text-text-secondary">
                <SpeakerIcon className="w-4 h-4 flex-shrink-0" />
                <span className="font-semibold text-text-primary">{agent.voice}</span>
                <span>({agent.speakingRate?.toFixed(1) ?? '1.0'}x Rate)</span>
                <span>- {agent.autoPlayAudio ? 'Auto-Play On' : 'Auto-Play Off'}</span>
            </div>
             <div className="flex items-center gap-2 text-text-secondary">
                <DatabaseIcon className="w-4 h-4 flex-shrink-0" />
                 {agent.knowledgeBaseUrl ? (
                    <span className="font-semibold text-brand-hover truncate" title={agent.knowledgeBaseUrl}>{agent.knowledgeBaseUrl}</span>
                 ) : (
                    <span>No RAG configured</span>
                 )}
            </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center pt-3 mt-3 border-t border-accent gap-2">
            {!isDefault ? (
            <button 
                onClick={onSetDefault} 
                className="px-4 py-2 text-sm font-semibold bg-primary border border-accent text-text-secondary hover:bg-accent hover:text-text-primary rounded-xl transition-colors flex-grow text-center"
            >
                Set as Default
            </button>
            ) : <div className="flex-grow"></div>}

            <div className="flex gap-1">
                <button onClick={onEdit} className="p-2 text-text-secondary hover:text-white hover:bg-accent rounded-xl transition-colors" title="Edit Agent">
                    <PencilIcon className="w-4 h-4" />
                </button>
                <button onClick={onDelete} className="p-2 text-text-secondary hover:text-red-400 hover:bg-red-900/20 rounded-xl transition-colors" title="Delete Agent">
                    <TrashIcon className="w-4 h-4" />
                </button>
            </div>
        </div>
    </div>
);


export const AgentsView: React.FC<AgentsViewProps> = ({ agents, onSaveAgent, onDeleteAgent, defaultAgentId, onSetDefaultAgent, onResetAgents }) => {
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

  const handleSave = (agent: Omit<Agent, 'id' | 'isCustom'> & { id?: string }) => {
    onSaveAgent(agent);
    setIsFormVisible(false);
    setEditingAgent(null);
  };

  const handleDelete = (agentId: string) => {
    if (window.confirm("Are you sure you want to delete this agent? This action cannot be undone.")) {
      onDeleteAgent(agentId);
    }
  };

  const handleReset = () => {
    if (window.confirm("Are you sure you want to reset all agents to their original defaults? All your custom agents and modifications will be lost.")) {
        onResetAgents();
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <div className="flex justify-between items-start gap-4 mb-4">
          <div>
            <h2 className="text-2xl font-bold text-text-primary">Manage Agents</h2>
            <p className="text-text-secondary">Create, edit, and manage your personalized AI personas.</p>
          </div>
          <button
            onClick={handleReset}
            className="text-xs text-text-secondary hover:text-red-400 hover:underline transition-colors flex-shrink-0 pt-1"
            title="Reset all agents to their initial state. This cannot be undone."
          >
            Reset to Defaults
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {agents.map(agent => (
            <AgentCard 
              key={agent.id}
              agent={agent} 
              isDefault={agent.id === defaultAgentId}
              onSetDefault={() => onSetDefaultAgent(agent.id)}
              onEdit={() => handleEdit(agent)}
              onDelete={() => handleDelete(agent.id)}
            />
          ))}

          <button
            onClick={handleCreateNew}
            className="bg-secondary border-2 border-accent border-dashed rounded-xl p-4 flex flex-col items-center justify-center min-h-[350px] transition-all hover:border-brand hover:text-brand text-text-secondary group"
            aria-label="Create a new agent"
          >
            <PlusIcon className="w-8 h-8 mb-2 transition-transform group-hover:scale-110" />
            <span className="font-semibold text-lg">Create New Agent</span>
          </button>
        </div>
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