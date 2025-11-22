export interface PromptTemplate {
  id: string;
  name: string;
  content: string;
  isDefault?: boolean;
}

const TEMPLATES_STORAGE_KEY = 'prompt-templates-v1';

const DEFAULT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'default-sdxl-1',
    name: 'Standard SDXL Cinematography',
    isDefault: true,
    content: `Based on the following detailed analysis, generate a complete and optimized Stable Diffusion XL prompt set. The output MUST be formatted as clean, semantic HTML.

The response must include the following three sections:
1.  An <h3> with the text "🎬 Positive Prompt". Followed by a <p> tag containing the single, consolidated paragraph of keywords.
2.  An <h3> with the text "🛑 Negative Prompt". Followed by a <p> tag containing the tailored negative prompt.
3.  An <h3> with the text "💡 Cinematographer's Notes". Followed by a <ul> with <li> items explaining 2-3 key choices made in the positive prompt (e.g., why a specific lens was chosen, or how a lighting term will affect the outcome).

Do not include <html>, <head>, or <body> tags.

**Analysis:**
"{{ANALYSIS_TEXT}}"`,
  },
];

function loadTemplatesFromStorage(): PromptTemplate[] {
  try {
    const saved = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error("Failed to load prompt templates from localStorage:", error);
    return [];
  }
}

function saveTemplatesToStorage(templates: PromptTemplate[]): void {
  try {
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
  } catch (error) {
    console.error("Failed to save prompt templates to localStorage:", error);
  }
}

export function getPromptTemplates(): PromptTemplate[] {
  let templates = loadTemplatesFromStorage();
  if (templates.length === 0) {
    templates = DEFAULT_TEMPLATES;
    saveTemplatesToStorage(templates);
  }
  return templates;
}

export function savePromptTemplate(template: Omit<PromptTemplate, 'id'> & { id?: string }): PromptTemplate {
  const allTemplates = getPromptTemplates();
  const isNew = !template.id;

  const newTemplateData: PromptTemplate = {
    ...template,
    id: template.id || `custom-${crypto.randomUUID()}`,
  };

  if (isNew) {
    allTemplates.push(newTemplateData);
  } else {
    const existingIndex = allTemplates.findIndex(t => t.id === newTemplateData.id);
    if (existingIndex !== -1) {
      allTemplates[existingIndex] = newTemplateData;
    } else {
      allTemplates.push(newTemplateData);
    }
  }

  saveTemplatesToStorage(allTemplates);
  return newTemplateData;
}

export function deletePromptTemplate(templateId: string): void {
  let allTemplates = getPromptTemplates();
  allTemplates = allTemplates.filter(t => t.id !== templateId);
  saveTemplatesToStorage(allTemplates);
}

export function setDefaultPromptTemplate(templateId: string): void {
    const allTemplates = getPromptTemplates().map(t => ({
        ...t,
        isDefault: t.id === templateId,
    }));
    saveTemplatesToStorage(allTemplates);
}

export function getDefaultPromptTemplate(): PromptTemplate | undefined {
    return getPromptTemplates().find(t => t.isDefault);
}

export function resetPromptTemplatesToDefault(): PromptTemplate[] {
    saveTemplatesToStorage(DEFAULT_TEMPLATES);
    return DEFAULT_TEMPLATES;
}