import React, { useState } from 'react';
import { PromptTemplate } from '../services/promptTemplateService';

interface PromptTemplateFormProps {
  template?: PromptTemplate | null;
  onSave: (template: Omit<PromptTemplate, 'id' | 'isDefault'> & { id?: string }) => void;
  onCancel: () => void;
}

export const PromptTemplateForm: React.FC<PromptTemplateFormProps> = ({ template, onSave, onCancel }) => {
  const [name, setName] = useState(template?.name || '');
  const [content, setContent] = useState(template?.content || '');
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !content.trim()) {
      setFormError("Template Name and Content cannot be empty.");
      return;
    }
    if (!content.includes('{{ANALYSIS_TEXT}}')) {
        setFormError("Template must include the {{ANALYSIS_TEXT}} placeholder.");
        return;
    }
    setFormError(null);
    onSave({
      id: template?.id,
      name,
      content,
    });
  };

  return (
    <div className="fixed inset-0 bg-primary/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <form onSubmit={handleSubmit} className="bg-secondary border border-accent rounded-xl p-6 w-full max-w-lg space-y-4 animate-fade-in max-h-[90vh] overflow-y-auto shadow-2xl">
        <h2 className="text-xl font-bold text-text-primary">{template ? 'Edit Template' : 'Create New Template'}</h2>
        
        {formError && (
          <div className="bg-red-900/20 border border-red-500/30 text-red-400 text-sm rounded-lg p-3">
              {formError}
          </div>
        )}

        <div>
          <label htmlFor="template-name" className="block text-sm font-medium text-text-primary mb-1">Template Name</label>
          <input
            id="template-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., 'SDXL Cinematography'"
            className="w-full p-2 bg-primary border border-accent rounded-xl focus:ring-2 focus:ring-brand focus:outline-none"
            required
          />
        </div>
        <div>
          <label htmlFor="template-content" className="block text-sm font-medium text-text-primary mb-1">Template Content</label>
          <textarea
            id="template-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Define the structure of your prompt..."
            className="w-full h-48 p-2 bg-primary border border-accent rounded-xl focus:ring-2 focus:ring-brand focus:outline-none resize-none font-mono text-sm"
            required
          />
           <p className="text-xs text-text-secondary px-1 mt-1">
              Use the placeholder <code className="text-xs bg-primary p-0.5 rounded text-brand-hover">{'{{ANALYSIS_TEXT}}'}</code> where the analysis should be inserted.
            </p>
        </div>
        
        <div className="flex justify-end space-x-3 pt-2">
          <button type="button" onClick={onCancel} className="px-6 py-3 bg-secondary border border-accent text-text-secondary font-semibold rounded-xl hover:bg-accent hover:text-text-primary transition-colors">Cancel</button>
          <button type="submit" className="px-6 py-3 bg-brand text-text-primary font-semibold rounded-xl hover:bg-brand-hover transition-all shadow-lg hover:shadow-xl active:scale-95">
            {template ? 'Update' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
};
