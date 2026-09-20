/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Project } from '../types';
import {
  Clapperboard,
  BookOpen,
  FolderPlus,
  Clock,
  ChevronRight,
  X,
  FileText,
  Sparkles,
  Trash2,
  Folder,
  Plus,
} from 'lucide-react';

interface ProjectHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  allProjects: Project[];
  activeProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onCreateNewProject: (title: string, templateType: 'screenplay' | 'prose' | 'blank') => void;
  onDeleteProject?: (projectId: string) => void;
}

export const ProjectHubModal: React.FC<ProjectHubModalProps> = ({
  isOpen,
  onClose,
  allProjects,
  activeProjectId,
  onSelectProject,
  onCreateNewProject,
  onDeleteProject, }) => {
  const [activeTab, setActiveTab] = useState<'hub' | 'new'>('hub');
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<'screenplay' | 'prose' | 'blank'>('screenplay');
  const [confirmingDeleteProjectId, setConfirmingDeleteProjectId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newProjectTitle.trim() || (
      selectedTemplate === 'screenplay'
        ? 'Untitled Screenplay'
        : selectedTemplate === 'prose'
        ? 'Untitled Manuscript'
        : 'New Project'
    );
    onCreateNewProject(title, selectedTemplate);
    setNewProjectTitle('');
    setActiveTab('hub');
    onClose();
  };

  const formatRelativeTime = (timestamp: number) => {
    const diffSec = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  };

  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-6 animate-in fade-in duration-200">
      <div className="bg-paper rounded-[var(--radius-ui)] shadow-2xl border border-rule max-w-3xl w-full overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header Bar */}
        <div className="px-8 py-6 border-b border-rule flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-[var(--radius-ui)] bg-ink text-paper flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5 text-paper opacity-60" />
            </div>
            <div>
              <h2 className="text-[14px] font-bold text-ink uppercase tracking-widest">
                Studio Hub
              </h2>
              <p className="text-[10px] text-graphite/60 font-bold uppercase tracking-tighter mt-0.5">
                Manuscript Repository & Session Manager
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {activeProjectId && (
              <button
                onClick={onClose}
                className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-graphite hover:text-ink transition-all cursor-pointer border-none bg-transparent"
              >
                Return to Editor
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-graphite hover:text-ink hover:bg-neutral-100 rounded-[var(--radius-ui)] cursor-pointer transition-all border-none bg-transparent"
            >
              <Plus className="w-6 h-6 rotate-45" />
            </button>
          </div>
        </div>

        {/* Tab Navigation Controls */}
        <div className="px-8 pt-4 pb-0 border-b border-rule flex gap-8 bg-paper text-[10px] font-bold uppercase tracking-widest">
          <button
            onClick={() => setActiveTab('hub')}
            className={`pb-4 border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'hub'
                ? 'border-ink text-ink'
                : 'border-transparent text-graphite/40 hover:text-ink'
            }`}
          >
            <Clock className="w-4 h-4 opacity-40" />
            <span>Repository ({allProjects.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('new')}
            className={`pb-4 border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'new'
                ? 'border-ink text-ink'
                : 'border-transparent text-graphite/40 hover:text-ink'
            }`}
          >
            <FolderPlus className="w-4 h-4 opacity-40" />
            <span>New Manuscript</span>
          </button>
        </div>

        {/* Main Content Body */}
        <div className="p-8 overflow-y-auto flex-1 bg-paper space-y-8 custom-scrollbar">
          {activeTab === 'hub' ? (
            <>
              {/* Starter Templates Section */}
              <div className="space-y-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-graphite/40">
                  Quick Starters
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Screenplay Template */}
                  <button
                    onClick={() => {
                      setSelectedTemplate('screenplay');
                      setActiveTab('new');
                    }}
                    className="p-5 rounded-[var(--radius-ui)] border border-rule bg-paper hover:border-ink hover:shadow-sm transition-all text-left group cursor-pointer flex flex-col justify-between h-32"
                  >
                    <div className="flex items-center justify-between">
                      <div className="p-2.5 rounded-[var(--radius-ui)] bg-neutral-100 group-hover:bg-ink group-hover:text-paper transition-all">
                        <Clapperboard className="w-5 h-5 text-graphite group-hover:text-paper" />
                      </div>
                      <span className="text-[10px] font-bold text-graphite/20 uppercase tracking-widest">Script</span>
                    </div>
                    <div>
                      <div className="text-[12px] font-bold text-ink uppercase tracking-wider">Screenplay</div>
                      <div className="text-[9px] text-graphite/60 mt-1 font-bold uppercase tracking-tighter">
                        10-Pitch Monospace Standard
                      </div>
                    </div>
                  </button>

                  {/* Prose Template */}
                  <button
                    onClick={() => {
                      setSelectedTemplate('prose');
                      setActiveTab('new');
                    }}
                    className="p-5 rounded-[var(--radius-ui)] border border-rule bg-paper hover:border-ink hover:shadow-sm transition-all text-left group cursor-pointer flex flex-col justify-between h-32"
                  >
                    <div className="flex items-center justify-between">
                      <div className="p-2.5 rounded-[var(--radius-ui)] bg-neutral-100 group-hover:bg-ink group-hover:text-paper transition-all">
                        <BookOpen className="w-5 h-5 text-graphite group-hover:text-paper" />
                      </div>
                      <span className="text-[10px] font-bold text-graphite/20 uppercase tracking-widest">Chapters</span>
                    </div>
                    <div>
                      <div className="text-[12px] font-bold text-ink uppercase tracking-wider">Manuscript</div>
                      <div className="text-[9px] text-graphite/60 mt-1 font-bold uppercase tracking-tighter">
                        Clean Narrative Paragraphs
                      </div>
                    </div>
                  </button>

                  {/* Blank Template */}
                  <button
                    onClick={() => {
                      setSelectedTemplate('blank');
                      setActiveTab('new');
                    }}
                    className="p-5 rounded-[var(--radius-ui)] border border-rule bg-paper hover:border-ink hover:shadow-sm transition-all text-left group cursor-pointer flex flex-col justify-between h-32"
                  >
                    <div className="flex items-center justify-between">
                      <div className="p-2.5 rounded-[var(--radius-ui)] bg-neutral-100 group-hover:bg-ink group-hover:text-paper transition-all">
                        <Folder className="w-5 h-5 text-graphite group-hover:text-paper" />
                      </div>
                      <span className="text-[10px] font-bold text-graphite/20 uppercase tracking-widest">Empty</span>
                    </div>
                    <div>
                      <div className="text-[12px] font-bold text-ink uppercase tracking-wider">Blank Folder</div>
                      <div className="text-[9px] text-graphite/60 mt-1 font-bold uppercase tracking-tighter">
                        Custom Binder Directory
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Saved Projects List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-rule pb-2">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-graphite/40">
                    Repository
                  </div>
                  <span className="text-[10px] text-graphite/40 font-mono font-bold uppercase tracking-tighter">
                    {allProjects.length} Items
                  </span>
                </div>

                <div className="space-y-2">
                  {allProjects.length === 0 ? (
                    <div className="p-12 text-center bg-neutral-50 rounded-[var(--radius-ui)] border border-rule/60 text-[11px] text-graphite/40 font-bold uppercase tracking-widest italic">
                      Empty Repository
                    </div>
                  ) : (
                    allProjects.map((proj) => {
                      const isActive = proj.metadata.id === activeProjectId;
                      const docCount = proj.binder.filter((b) => b.itemType === 'document' && !b.trashed).length;

                      return (
                        <div
                          key={proj.metadata.id}
                          className={`group flex items-center justify-between p-4 rounded-[var(--radius-ui)] border transition-all ${
                            isActive
                              ? 'bg-paper border-ink shadow-sm'
                              : 'bg-paper border-rule/60 hover:border-rule hover:shadow-xs'
                          }`}
                        >
                          <div
                            className="flex items-center gap-4 min-w-0 flex-1 cursor-pointer"
                            onClick={() => {
                              onSelectProject(proj.metadata.id);
                              onClose();
                            }}
                          >
                            <div className="w-10 h-10 rounded-[var(--radius-ui)] bg-neutral-50 border border-rule/40 flex items-center justify-center shrink-0">
                              <FileText className="w-5 h-5 text-graphite/60" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-3">
                                <span className="text-[13px] font-bold text-ink truncate uppercase tracking-tight">
                                  {proj.metadata.title}
                                </span>
                                {isActive && (
                                  <span className="px-2 py-0.5 rounded-[2px] text-[8px] font-bold bg-ink text-paper uppercase tracking-widest">
                                    Active
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-[10px] text-graphite/60 mt-0.5 font-bold uppercase tracking-tighter">
                                <span>{docCount} {docCount === 1 ? 'document' : 'documents'}</span>
                                <span className="opacity-40">•</span>
                                <span>Edited {formatRelativeTime(proj.metadata.updatedAt)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 ml-4">
                            {confirmingDeleteProjectId === proj.metadata.id ? (
                              <div className="flex items-center gap-2 bg-editor-red/5 border border-editor-red/20 p-1.5 rounded-[var(--radius-ui)]">
                                <span className="text-[9px] text-editor-red font-bold uppercase tracking-widest px-2">
                                  Delete?
                                </span>
                                <button
                                  onClick={() => {
                                    if (onDeleteProject) onDeleteProject(proj.metadata.id);
                                    setConfirmingDeleteProjectId(null);
                                  }}
                                  className="text-[9px] bg-editor-red hover:bg-red-700 text-paper font-bold px-3 py-1 rounded-[2px] cursor-pointer shadow-sm border-none uppercase tracking-widest"
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={() => setConfirmingDeleteProjectId(null)}
                                  className="text-[9px] text-graphite/60 hover:text-ink px-2 py-1 cursor-pointer font-bold uppercase tracking-widest border-none bg-transparent"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <>
                                {allProjects.length > 1 && onDeleteProject && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmingDeleteProjectId(proj.metadata.id);
                                    }}
                                    title="Delete project"
                                    className="p-2 opacity-0 group-hover:opacity-100 hover:text-editor-red text-graphite/40 rounded-[var(--radius-ui)] cursor-pointer transition-all border-none bg-transparent"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    onSelectProject(proj.metadata.id);
                                    onClose();
                                  }}
                                  className="flex items-center gap-2 px-5 py-2 bg-neutral-100 hover:bg-ink hover:text-paper text-ink text-[11px] font-bold uppercase tracking-widest rounded-[var(--radius-ui)] cursor-pointer transition-all border-none shadow-xs"
                                >
                                  <span>Open</span>
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Create New Project Form */
            <form onSubmit={handleCreateSubmit} className="space-y-6 bg-neutral-50/50 p-8 rounded-[var(--radius-ui)] border border-rule">
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-graphite/60">
                  Manuscript Title
                </label>
                <input
                  type="text"
                  autoFocus
                  value={newProjectTitle}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                  placeholder={
                    selectedTemplate === 'screenplay'
                      ? 'TITLE OF THE SCRIPT'
                      : selectedTemplate === 'prose'
                      ? 'TITLE OF THE MANUSCRIPT'
                      : 'NEW PROJECT TITLE'
                  }
                  className="w-full text-[13px] bg-paper border border-rule rounded-[var(--radius-ui)] px-4 py-3 text-ink font-bold uppercase tracking-wide outline-none focus:ring-1 focus:ring-ink transition-all shadow-sm placeholder:opacity-20 placeholder:italic placeholder:font-normal placeholder:normal-case"
                />
              </div>

              <div className="space-y-3">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-graphite/60">
                  Select Template
                </label>
                <div className="grid grid-cols-3 gap-4">
                  <div
                    onClick={() => setSelectedTemplate('screenplay')}
                    className={`p-4 rounded-[var(--radius-ui)] border transition-all cursor-pointer flex flex-col items-center text-center gap-3 ${
                      selectedTemplate === 'screenplay'
                        ? 'border-ink bg-paper shadow-md ring-1 ring-ink'
                        : 'border-rule/60 bg-paper/50 hover:border-rule'
                    }`}
                  >
                    <Clapperboard className={`w-6 h-6 ${selectedTemplate === 'screenplay' ? 'text-ink' : 'text-graphite/40'}`} />
                    <div>
                      <div className="text-[11px] font-bold text-ink uppercase tracking-wider">Screenplay</div>
                      <div className="text-[8px] text-graphite/40 mt-1 font-bold uppercase tracking-tighter">Script Format</div>
                    </div>
                  </div>

                  <div
                    onClick={() => setSelectedTemplate('prose')}
                    className={`p-4 rounded-[var(--radius-ui)] border transition-all cursor-pointer flex flex-col items-center text-center gap-3 ${
                      selectedTemplate === 'prose'
                        ? 'border-ink bg-paper shadow-md ring-1 ring-ink'
                        : 'border-rule/60 bg-paper/50 hover:border-rule'
                    }`}
                  >
                    <BookOpen className={`w-6 h-6 ${selectedTemplate === 'prose' ? 'text-ink' : 'text-graphite/40'}`} />
                    <div>
                      <div className="text-[11px] font-bold text-ink uppercase tracking-wider">Manuscript</div>
                      <div className="text-[8px] text-graphite/40 mt-1 font-bold uppercase tracking-tighter">Chapter Format</div>
                    </div>
                  </div>

                  <div
                    onClick={() => setSelectedTemplate('blank')}
                    className={`p-4 rounded-[var(--radius-ui)] border transition-all cursor-pointer flex flex-col items-center text-center gap-3 ${
                      selectedTemplate === 'blank'
                        ? 'border-ink bg-paper shadow-md ring-1 ring-ink'
                        : 'border-rule/60 bg-paper/50 hover:border-rule'
                    }`}
                  >
                    <Folder className={`w-6 h-6 ${selectedTemplate === 'blank' ? 'text-ink' : 'text-graphite/40'}`} />
                    <div>
                      <div className="text-[11px] font-bold text-ink uppercase tracking-wider">Empty</div>
                      <div className="text-[8px] text-graphite/40 mt-1 font-bold uppercase tracking-tighter">Binder Root</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-6 pt-6 border-t border-rule">
                <button
                  type="button"
                  onClick={() => setActiveTab('hub')}
                  className="px-6 py-2.5 text-[11px] font-bold uppercase tracking-widest text-graphite hover:text-ink transition-all cursor-pointer border-none bg-transparent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-8 py-2.5 bg-ink hover:bg-graphite text-paper rounded-[var(--radius-ui)] text-[11px] font-bold uppercase tracking-widest shadow-lg transition-all cursor-pointer border-none"
                >
                  Launch Studio
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
