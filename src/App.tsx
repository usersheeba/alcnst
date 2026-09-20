/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Project,
  ScreenplayDocument,
  ProseDocument,
  DocumentModel,
  CaretPosition,
  EditorCommand,
  DocumentType,
  SceneMetadata,
  DocumentFormattingSettings,
} from './types';
import { PageFormat } from './core/screenplay_layout';
import { generateId, executeCommand } from './core/commands';
import { HistoryManager } from './core/history';
import {
  saveProject,
  loadProject,
  listProjects,
  saveDocument,
  loadDocument,
  deleteDocument,
  deleteProject,
} from './core/persistence';
import {
  SyncStatus,
  saveToLocalStorage,
  getLastEditedDocId,
  syncToCloud,
  downloadBackupFile,
} from './core/cloudSync';
import { initTheme } from './core/themeManager';
import { Binder } from './components/Binder';
import { ScreenplayEditor } from './components/ScreenplayEditor';
import { ProseEditor } from './components/ProseEditor';
import { PageThumbnailsPanel } from './components/PageThumbnailsPanel';
import { PdfModal } from './components/PdfModal';
import { ProjectHubModal } from './components/ProjectHubModal';
import { DocumentSettingsModal } from './components/DocumentSettingsModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { ThemeToggle } from './components/ThemeToggle';
import { DEFAULT_FORMATTING_SETTINGS } from './types';
import { htmlToFountain, htmlToFdxClean, htmlToMarkdown, stripHtml } from './core/rich_text';
import {
  Undo2,
  Redo2,
  Cloud,
  CloudOff,
  Check,
  CheckCircle2,
  FileCheck,
  Download,
  FileText,
  FileCode,
  FileType,
  ChevronDown,
  PanelRight,
  PanelLeft,
  Sparkles,
  Settings,
  MoreHorizontal,
} from 'lucide-react';

const INITIAL_PROJECT_ID = 'proj_clean_studio_v1';
const INITIAL_SCREENPLAY_ID = 'doc_untitled_script_v1';

export default function App() {
  const [project, setProject] = useState<Project | null>(null);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [activeDoc, setActiveDoc] = useState<DocumentModel | null>(null);
  const [caret, setCaret] = useState<CaretPosition | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('saved');
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'seamless' | 'page'>('seamless');

  // Modals, Menus, & Sidebars
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isHubModalOpen, setIsHubModalOpen] = useState(false);
  const [isDocumentSettingsOpen, setIsDocumentSettingsOpen] = useState(false);
  const [documentSettingsInitialTab, setDocumentSettingsInitialTab] = useState<'elements' | 'typography' | 'titlePage' | 'geometry' | 'production'>('elements');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isBinderOpen, setIsBinderOpen] = useState(true);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false); // Collapsed by default
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Initialize Theme System
  useEffect(() => {
    const cleanupTheme = initTheme();
    return () => cleanupTheme();
  }, []);

  // Network Online / Offline Status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (activeDoc) {
        setSyncStatus('saving');
        syncToCloud(activeDoc as ScreenplayDocument).then((ok) => {
          setSyncStatus(ok ? 'saved' : 'offline');
        });
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [activeDoc]);

  // Debounced Local Auto-Save (500ms) & Background Cloud Sync (3000ms)
  useEffect(() => {
    if (!activeDoc) return;

    setSyncStatus('saving');
    saveToLocalStorage(activeDoc as ScreenplayDocument);

    const localTimer = setTimeout(async () => {
      await saveDocument(activeDoc);
    }, 500);

    const cloudTimer = setTimeout(async () => {
      if (navigator.onLine) {
        const ok = await syncToCloud(activeDoc as ScreenplayDocument);
        setSyncStatus(ok ? 'saved' : 'offline');
      } else {
        setSyncStatus('offline');
      }
    }, 3000);

    return () => {
      clearTimeout(localTimer);
      clearTimeout(cloudTimer);
    };
  }, [activeDoc]);

  // Keyboard Shortcut Override: Cmd+S / Ctrl+S for Immediate Save & Backup Download
  const handleManualSaveAndBackup = async () => {
    if (!activeDoc) return;
    setSyncStatus('saving');
    saveToLocalStorage(activeDoc as ScreenplayDocument);
    await saveDocument(activeDoc);

    let cloudOk = false;
    if (navigator.onLine) {
      cloudOk = await syncToCloud(activeDoc as ScreenplayDocument);
    }
    setSyncStatus(cloudOk ? 'saved' : 'offline');

    if (activeDoc.documentType === 'screenplay') {
      downloadBackupFile(activeDoc as ScreenplayDocument, 'fountain');
      setToastMessage('Saved to Cloud & Fountain Backup Downloaded');
    } else {
      downloadBackupFile(activeDoc as unknown as ScreenplayDocument, 'json');
      setToastMessage('Saved to Cloud & JSON Backup Downloaded');
    }

    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleManualSaveAndBackup();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeDoc]);

  const handleOpenDocumentSettings = (tab: 'elements' | 'typography' | 'titlePage' | 'geometry' | 'production' = 'elements') => {
    setDocumentSettingsInitialTab(tab);
    setIsDocumentSettingsOpen(true);
  };

  const handleSaveDocumentSettings = async (updatedSettings: DocumentFormattingSettings) => {
    if (!activeDoc || activeDoc.documentType !== 'screenplay') return;
    const updatedDoc: ScreenplayDocument = {
      ...(activeDoc as ScreenplayDocument),
      formattingSettings: updatedSettings,
      updatedAt: Date.now(),
    };
    setActiveDoc(updatedDoc);
    setSyncStatus('saving');
    await saveDocument(updatedDoc);
    setTimeout(() => setSyncStatus('saved'), 300);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    if (isExportMenuOpen) {
      window.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExportMenuOpen]);

  // Isolated Undo / Redo Managers and Carets per document
  const docHistoriesRef = useRef<Map<string, HistoryManager>>(new Map());
  const docCaretsRef = useRef<Map<string, CaretPosition | null>>(new Map());
  const [, setHistoryUpdateCounter] = useState(0); // Trigger re-render for canUndo/canRedo

  const getDocHistory = (docId: string): HistoryManager => {
    let hist = docHistoriesRef.current.get(docId);
    if (!hist) {
      hist = new HistoryManager();
      docHistoriesRef.current.set(docId, hist);
    }
    return hist;
  };

  // 1. App Initialization / Storage Hydration
  useEffect(() => {
    const initApp = async () => {
      const allP = await listProjects();
      setAllProjects(allP);

      if (allP.length === 0) {
        setIsHubModalOpen(true);
        return;
      }

      // Load first available project
      const existingProj = await loadProject(allP[0].metadata.id);
      if (existingProj) {
        setProject(existingProj);

        const lastDocId = getLastEditedDocId();
        let targetDocId = lastDocId;

        if (lastDocId) {
          const exists = existingProj.binder.some((i) => i.id === lastDocId && !i.trashed);
          if (!exists) targetDocId = null;
        }

        if (!targetDocId) {
          const firstDocItem = existingProj.binder.find(
            (item) => item.itemType === 'document' && !item.trashed
          );
          targetDocId = firstDocItem ? firstDocItem.id : null;
        }
        
        if (targetDocId) {
          const loadedDoc = await loadDocument(targetDocId);
          if (loadedDoc) {
            setActiveDoc(loadedDoc);
            if (loadedDoc.documentType === 'screenplay' && loadedDoc.nodes.length > 0) {
              setCaret({
                nodeId: loadedDoc.nodes[0].id,
                offset: loadedDoc.nodes[0].text.length,
              });
            }
          }
        }
      }
    };

    initApp();
  }, []);

  // 2. Select Document from Binder (Preserves Per-Document Caret & Isolated History)
  const handleSelectDocument = async (docId: string) => {
    if (activeDoc?.id === docId) return;

    // Flush current document and save caret position
    if (activeDoc) {
      docCaretsRef.current.set(activeDoc.id, caret);
      await saveDocument(activeDoc);
    }

    const doc = await loadDocument(docId);
    if (doc) {
      setActiveDoc(doc);
      setHistoryUpdateCounter((c) => c + 1);

      const rememberedCaret = docCaretsRef.current.get(docId);
      if (rememberedCaret) {
        setCaret(rememberedCaret);
      } else if (doc.documentType === 'screenplay' && doc.nodes.length > 0) {
        setCaret({
          nodeId: doc.nodes[0].id,
          offset: doc.nodes[0].text.length,
        });
      } else {
        setCaret(null);
      }
    }
  };

  // 3. Command Execution Layer (Single Source of Truth)
  const handleDispatchCommand = (command: EditorCommand) => {
    if (!activeDoc || activeDoc.documentType !== 'screenplay') return;

    const result = executeCommand(activeDoc, command, caret);
    if ('error' in result) {
      console.warn('Command validation error:', result.error);
      return;
    }

    const { newDoc, newCaret, transaction } = result;

    setActiveDoc(newDoc);
    setCaret(newCaret);
    const history = getDocHistory(activeDoc.id);
    history.push(transaction);
    setHistoryUpdateCounter((c) => c + 1);

    // Debounced local persistence
    setSyncStatus('saving');
    saveDocument(newDoc).then(() => {
      setSyncStatus('saved');
    });
  };

  // 4. Undo / Redo Handlers (Isolated Per Document)
  const handleUndo = () => {
    if (!activeDoc || activeDoc.documentType !== 'screenplay') return;
    const history = getDocHistory(activeDoc.id);
    const res = history.undo(activeDoc);
    if (res) {
      setActiveDoc(res.newDoc);
      setCaret(res.caret);
      setHistoryUpdateCounter((c) => c + 1);
      saveDocument(res.newDoc);
    }
  };

  const handleRedo = () => {
    if (!activeDoc || activeDoc.documentType !== 'screenplay') return;
    const history = getDocHistory(activeDoc.id);
    const res = history.redo(activeDoc);
    if (res) {
      setActiveDoc(res.newDoc);
      setCaret(res.caret);
      setHistoryUpdateCounter((c) => c + 1);
      saveDocument(res.newDoc);
    }
  };

  // 5. Binder Hierarchy Mutations
  const handleCreateFolder = async (parentId: string | null, title: string) => {
    if (!project) return;
    const newFolder = {
      id: generateId('fld'),
      projectId: project.metadata.id,
      parentId,
      title,
      itemType: 'folder' as const,
      sortOrder: project.binder.length + 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const updatedProject = {
      ...project,
      binder: [...project.binder, newFolder],
    };
    setProject(updatedProject);
    await saveProject(updatedProject);
  };

  const handleCreateDocument = async (
    parentId: string | null,
    title: string,
    docType: DocumentType
  ) => {
    if (!project) return;
    const docId = generateId('doc');

    const newBinderItem = {
      id: docId,
      projectId: project.metadata.id,
      parentId,
      title,
      itemType: 'document' as const,
      documentType: docType,
      sortOrder: project.binder.length + 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    let newDoc: DocumentModel;
    if (docType === 'screenplay') {
      newDoc = {
        id: docId,
        projectId: project.metadata.id,
        title,
        documentType: 'screenplay',
        schemaVersion: 1,
        nodes: [
          {
            id: generateId('node'),
            type: 'sceneHeading',
            text: '',
            sceneId: 'sc_init',
            attrs: { sceneNumber: '1' },
          },
        ],
        scenes: {
          sc_init: {
            id: 'sc_init',
            headingNodeId: '',
            sceneNumber: '1',
            location: '',
            timeOfDay: '',
            synopsis: '',
            notes: [],
            status: 'Draft',
            characters: [],
            updatedAt: Date.now(),
          },
        },
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      newDoc.scenes.sc_init.headingNodeId = newDoc.nodes[0].id;
    } else {
      newDoc = {
        id: docId,
        projectId: project.metadata.id,
        title,
        documentType: docType,
        schemaVersion: 1,
        nodes: [
          {
            id: generateId('pn'),
            type: 'paragraph',
            text: '',
          },
        ],
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    const updatedProject = {
      ...project,
      binder: [...project.binder, newBinderItem],
    };

    setProject(updatedProject);
    setActiveDoc(newDoc);
    setHistoryUpdateCounter((c) => c + 1);

    await saveProject(updatedProject);
    await saveDocument(newDoc);
  };

  const handleUpdateProjectTitle = async (newTitle: string) => {
    if (!project || !newTitle.trim()) return;
    const updatedProject = {
      ...project,
      metadata: {
        ...project.metadata,
        title: newTitle.trim(),
        updatedAt: Date.now(),
      },
    };
    setProject(updatedProject);
    await saveProject(updatedProject);
  };

  const handleTogglePaperFormat = async () => {
    if (!activeDoc || activeDoc.documentType !== 'screenplay') return;
    const currentFormat: PageFormat = activeDoc.formattingSettings?.paperFormat || 'US_LETTER';
    const newFormat: PageFormat = currentFormat === 'US_LETTER' ? 'A4' : 'US_LETTER';

    const updatedDoc: ScreenplayDocument = {
      ...(activeDoc as ScreenplayDocument),
      formattingSettings: {
        ...((activeDoc as ScreenplayDocument).formattingSettings || DEFAULT_FORMATTING_SETTINGS),
        paperFormat: newFormat,
      },
      updatedAt: Date.now(),
    };

    setActiveDoc(updatedDoc);
    setSyncStatus('saving');
    await saveDocument(updatedDoc);
    setTimeout(() => setSyncStatus('saved'), 300);

    setToastMessage(`Page format switched to ${newFormat.replace('_', ' ')}`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSelectProject = async (projectId: string) => {
    const selected = await loadProject(projectId);
    if (!selected) return;
    setProject(selected);

    // Find first active non-trashed document
    const activeDocs = selected.binder.filter((b) => b.itemType === 'document' && !b.trashed);
    if (activeDocs.length > 0) {
      handleSelectDocument(activeDocs[0].id);
    } else {
      setActiveDoc(null);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    await deleteProject(projectId);
    const updatedList = await listProjects();
    setAllProjects(updatedList);

    // If active project was deleted, switch to another existing project or create standard
    if (project && project.metadata.id === projectId) {
      if (updatedList.length > 0) {
        handleSelectProject(updatedList[0].metadata.id);
      } else {
        await handleCreateNewProject('My Screenplay Project', 'screenplay');
      }
    }
  };

  const handleCreateNewProject = async (
    title: string,
    templateType: 'screenplay' | 'prose' | 'blank' = 'screenplay'
  ) => {
    const newProjId = generateId('proj');
    const newDocId = generateId('doc');
    const now = Date.now();

    const binderItems = [];
    if (templateType !== 'blank') {
      binderItems.push({
        id: newDocId,
        projectId: newProjId,
        parentId: null,
        title: templateType === 'screenplay' ? 'Screenplay' : 'Chapter 1',
        itemType: 'document' as const,
        documentType: templateType as DocumentType,
        sortOrder: 1,
        createdAt: now,
        updatedAt: now,
      });
    }

    const newProject: Project = {
      metadata: {
        id: newProjId,
        title: title.trim() || 'Untitled Project',
        authors: [],
        revisionTag: 'First Draft',
        createdAt: now,
        updatedAt: now,
      },
      binder: binderItems,
    };

    await saveProject(newProject);

    if (templateType === 'screenplay') {
      const initialHeadingNodeId = generateId('node');
      const newScriptDoc: ScreenplayDocument = {
        id: newDocId,
        projectId: newProjId,
        title: 'Screenplay',
        documentType: 'screenplay',
        schemaVersion: 1,
        nodes: [
          {
            id: initialHeadingNodeId,
            type: 'sceneHeading',
            text: '',
            sceneId: 'sc_1',
            attrs: { sceneNumber: '1' },
          },
        ],
        scenes: {
          sc_1: {
            id: 'sc_1',
            headingNodeId: initialHeadingNodeId,
            sceneNumber: '1',
            location: '',
            timeOfDay: '',
            synopsis: '',
            notes: [],
            status: 'Draft',
            characters: [],
            updatedAt: now,
          },
        },
        version: 1,
        createdAt: now,
        updatedAt: now,
      };

      await saveDocument(newScriptDoc);
      setActiveDoc(newScriptDoc);
      setCaret({ nodeId: initialHeadingNodeId, offset: 0 });
    } else if (templateType === 'prose') {
      const newProseDoc: ProseDocument = {
        id: newDocId,
        projectId: newProjId,
        title: 'Chapter 1',
        documentType: 'prose',
        schemaVersion: 1,
        nodes: [
          {
            id: generateId('pr_node'),
            type: 'paragraph',
            text: '',
          },
        ],
        version: 1,
        createdAt: now,
        updatedAt: now,
      };

      await saveDocument(newProseDoc);
      setActiveDoc(newProseDoc);
      setCaret(null);
    } else {
      setActiveDoc(null);
      setCaret(null);
    }

    setProject(newProject);
    const updatedList = await listProjects();
    setAllProjects(updatedList);
  };

  const handleRenameItem = async (itemId: string, newTitle: string) => {
    if (!project || !newTitle.trim()) return;
    const trimmed = newTitle.trim();
    const updatedBinder = project.binder.map((b) =>
      b.id === itemId ? { ...b, title: trimmed, updatedAt: Date.now() } : b
    );
    const updatedProject = { ...project, binder: updatedBinder };
    setProject(updatedProject);
    await saveProject(updatedProject);

    // If active document is renamed, update its document model as well
    if (activeDoc && activeDoc.id === itemId) {
      const updatedDoc = { ...activeDoc, title: trimmed, updatedAt: Date.now() };
      setActiveDoc(updatedDoc);
      await saveDocument(updatedDoc);
    } else {
      const storedDoc = await loadDocument(itemId);
      if (storedDoc) {
        storedDoc.title = trimmed;
        storedDoc.updatedAt = Date.now();
        await saveDocument(storedDoc);
      }
    }
  };

  const handleReorderItem = async (itemId: string, direction: 'up' | 'down') => {
    if (!project) return;
    const item = project.binder.find((b) => b.id === itemId);
    if (!item) return;

    // Siblings under the same parent
    const siblings = project.binder
      .filter((b) => b.parentId === item.parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const currentIndex = siblings.findIndex((b) => b.id === itemId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= siblings.length) return;

    const targetSibling = siblings[targetIndex];
    const originalSort = item.sortOrder;

    const updatedBinder = project.binder.map((b) => {
      if (b.id === item.id) return { ...b, sortOrder: targetSibling.sortOrder };
      if (b.id === targetSibling.id) return { ...b, sortOrder: originalSort };
      return b;
    });

    const updatedProject = { ...project, binder: updatedBinder };
    setProject(updatedProject);
    await saveProject(updatedProject);
  };

  // Helper to recursively collect all descendant IDs (folders and documents at any depth)
  const getAllDescendantIds = (rootId: string, binder: any[]): Set<string> => {
    const ids = new Set<string>([rootId]);
    const queue = [rootId];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = binder.filter((b) => b.parentId === currentId);
      for (const child of children) {
        ids.add(child.id);
        if (child.itemType === 'folder') {
          queue.push(child.id);
        }
      }
    }
    return ids;
  };

  const handleDeleteBinderItem = async (itemId: string) => {
    if (!project) return;
    const targetIds = getAllDescendantIds(itemId, project.binder);
    const now = Date.now();

    const updatedBinder = project.binder.map((b) =>
      targetIds.has(b.id) ? { ...b, trashed: true, trashedAt: now, updatedAt: now } : b
    );
    const updatedProject = { ...project, binder: updatedBinder };
    setProject(updatedProject);
    await saveProject(updatedProject);

    if (activeDoc && targetIds.has(activeDoc.id)) {
      const remainingDocs = updatedBinder.filter((b) => b.itemType === 'document' && !b.trashed);
      if (remainingDocs.length > 0) {
        handleSelectDocument(remainingDocs[0].id);
      } else {
        setActiveDoc(null);
      }
    }
  };

  const handleRestoreBinderItem = async (itemId: string) => {
    if (!project) return;
    const targetIds = getAllDescendantIds(itemId, project.binder);
    const now = Date.now();

    const activeFolderIds = new Set(
      project.binder.filter((b) => b.itemType === 'folder' && !b.trashed).map((b) => b.id)
    );

    const updatedBinder = project.binder.map((b) => {
      if (targetIds.has(b.id)) {
        // If parent folder is trashed or missing, fallback to root (null)
        const validParentId = b.parentId && activeFolderIds.has(b.parentId) ? b.parentId : null;
        return { ...b, trashed: false, parentId: validParentId, updatedAt: now };
      }
      return b;
    });

    const updatedProject = { ...project, binder: updatedBinder };
    setProject(updatedProject);
    await saveProject(updatedProject);
  };

  const handlePermanentDeleteBinderItem = async (itemId: string) => {
    if (!project) return;
    const targetIds = getAllDescendantIds(itemId, project.binder);
    const updatedBinder = project.binder.filter((b) => !targetIds.has(b.id));

    const updatedProject = { ...project, binder: updatedBinder };
    setProject(updatedProject);
    await saveProject(updatedProject);

    // Hard purge documents from IndexedDB
    for (const id of targetIds) {
      await deleteDocument(id);
    }
  };

  const handleEmptyTrash = async () => {
    if (!project) return;
    const trashedDocIds = project.binder.filter((b) => b.trashed && b.itemType === 'document').map((b) => b.id);
    const updatedBinder = project.binder.filter((b) => !b.trashed);

    const updatedProject = { ...project, binder: updatedBinder };
    setProject(updatedProject);
    await saveProject(updatedProject);

    // Hard purge all trashed documents from IndexedDB
    for (const docId of trashedDocIds) {
      await deleteDocument(docId);
    }
  };

  const handleMoveBinderItem = async (draggedId: string, targetParentId: string | null) => {
    if (!project || draggedId === targetParentId) return;
    const updatedBinder = project.binder.map((b) =>
      b.id === draggedId ? { ...b, parentId: targetParentId, updatedAt: Date.now() } : b
    );
    const updatedProject = { ...project, binder: updatedBinder };
    setProject(updatedProject);
    await saveProject(updatedProject);
  };

  // 6. Scene Metadata Update
  const handleUpdateSceneMeta = (updatedScene: SceneMetadata) => {
    if (!activeDoc || activeDoc.documentType !== 'screenplay') return;
    const updatedDoc: ScreenplayDocument = {
      ...activeDoc,
      scenes: {
        ...activeDoc.scenes,
        [updatedScene.id]: updatedScene,
      },
      updatedAt: Date.now(),
    };
    setActiveDoc(updatedDoc);
    saveDocument(updatedDoc);
  };

  // 7. Export Handlers: Fountain, Final Draft XML (FDX), Markdown (MD), PDF
  const handleExportFountain = () => {
    if (!activeDoc || activeDoc.documentType !== 'screenplay') return;

    const lines: string[] = [
      `Title: ${activeDoc.title}`,
      `Credit: Written by`,
      `Author: ${project?.metadata.authors.join(' & ') || 'Screenwriter'}`,
      `Draft date: ${new Date().toLocaleDateString()}`,
      `===`,
      ``,
    ];

    activeDoc.nodes.forEach((node) => {
      const cleanFountainText = htmlToFountain(node.text);
      switch (node.type) {
        case 'sceneHeading':
          lines.push(`${stripHtml(node.text).toUpperCase()}`);
          lines.push('');
          break;
        case 'action':
          lines.push(cleanFountainText);
          lines.push('');
          break;
        case 'character':
          lines.push(`${stripHtml(node.text).toUpperCase()}`);
          break;
        case 'parenthetical':
          lines.push(cleanFountainText.startsWith('(') ? cleanFountainText : `(${cleanFountainText.replace(/^\(|\)$/g, '')})`);
          break;
        case 'dialogue':
          lines.push(cleanFountainText);
          lines.push('');
          break;
        case 'transition':
          lines.push(`> ${stripHtml(node.text).toUpperCase()}`);
          lines.push('');
          break;
        case 'shot':
          lines.push(`${stripHtml(node.text).toUpperCase()}`);
          lines.push('');
          break;
        case 'textNote':
          lines.push(`[[ ${cleanFountainText} ]]`);
          lines.push('');
          break;
      }
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeDoc.title.toLowerCase().replace(/\s+/g, '_')}.fountain`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportFDX = () => {
    if (!activeDoc) return;
    let xml = `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>\n`;
    xml += `<FinalDraft DocumentType="Script" Template="No" Version="4">\n`;
    xml += `  <Content>\n`;

    if (activeDoc.documentType === 'screenplay') {
      activeDoc.nodes.forEach((node) => {
        let fdxType = 'Action';
        if (node.type === 'sceneHeading') fdxType = 'Scene Heading';
        else if (node.type === 'character') fdxType = 'Character';
        else if (node.type === 'parenthetical') fdxType = 'Parenthetical';
        else if (node.type === 'dialogue') fdxType = 'Dialogue';
        else if (node.type === 'transition') fdxType = 'Transition';
        else if (node.type === 'shot') fdxType = 'Shot';

        const escaped = htmlToFdxClean(node.text);
        xml += `    <Paragraph Type="${fdxType}"><Text>${escaped}</Text></Paragraph>\n`;
      });
    } else {
      activeDoc.nodes.forEach((node) => {
        const escaped = htmlToFdxClean(node.text);
        xml += `    <Paragraph Type="Action"><Text>${escaped}</Text></Paragraph>\n`;
      });
    }

    xml += `  </Content>\n</FinalDraft>`;

    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeDoc.title.toLowerCase().replace(/\s+/g, '_')}.fdx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportMarkdown = () => {
    if (!activeDoc) return;
    const lines: string[] = [`# ${activeDoc.title}`, ''];

    if (activeDoc.documentType === 'screenplay') {
      activeDoc.nodes.forEach((node) => {
        const mdText = htmlToMarkdown(node.text);
        if (node.type === 'sceneHeading') {
          lines.push(`## ${stripHtml(node.text).toUpperCase()}`);
          lines.push('');
        } else if (node.type === 'character') {
          lines.push(`**${stripHtml(node.text).toUpperCase()}**`);
        } else if (node.type === 'parenthetical') {
          lines.push(`*(${stripHtml(node.text).replace(/^\(|\)$/g, '')})*`);
        } else if (node.type === 'dialogue') {
          lines.push(`> ${mdText}`);
          lines.push('');
        } else if (node.type === 'transition') {
          lines.push(`_${stripHtml(node.text).toUpperCase()}_`);
          lines.push('');
        } else {
          lines.push(mdText);
          lines.push('');
        }
      });
    } else {
      activeDoc.nodes.forEach((node) => {
        const mdText = htmlToMarkdown(node.text);
        if (node.type === 'heading1') {
          lines.push(`# ${stripHtml(node.text)}`);
        } else if (node.type === 'heading2') {
          lines.push(`## ${stripHtml(node.text)}`);
        } else if (node.type === 'bulletItem') {
          lines.push(`- ${mdText}`);
        } else if (node.type === 'numberedItem') {
          lines.push(`1. ${mdText}`);
        } else if (node.type === 'blockquote') {
          lines.push(`> ${mdText}`);
        } else {
          lines.push(mdText);
        }
        lines.push('');
      });
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeDoc.title.toLowerCase().replace(/\s+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpdateFormattingSettingsPartial = async (partial: Partial<DocumentFormattingSettings>) => {
    if (!activeDoc || activeDoc.documentType !== 'screenplay') return;
    const currentSettings = activeDoc.formattingSettings || DEFAULT_FORMATTING_SETTINGS;
    const updatedSettings: DocumentFormattingSettings = {
      ...currentSettings,
      ...partial,
    };
    await saveDocument({
      ...activeDoc,
      formattingSettings: updatedSettings,
      updatedAt: Date.now(),
    });
    setActiveDoc((prev) =>
      prev && prev.id === activeDoc.id
        ? {
            ...(prev as ScreenplayDocument),
            formattingSettings: updatedSettings,
            updatedAt: Date.now(),
          }
        : prev
    );
  };

  // Resolve current active scene for SceneInspector
  let activeScene: SceneMetadata | null = null;
  if (activeDoc && activeDoc.documentType === 'screenplay' && caret) {
    const activeNode = activeDoc.nodes.find((n) => n.id === caret.nodeId);
    if (activeNode?.sceneId && activeDoc.scenes[activeNode.sceneId]) {
      activeScene = activeDoc.scenes[activeNode.sceneId];
    } else if (Object.keys(activeDoc.scenes).length > 0) {
      activeScene = Object.values(activeDoc.scenes)[0];
    }
  }

  const handleJumpToPage = (pageNum: number) => {
    const pageElem = document.getElementById(`page-marker-${pageNum}`);
    if (pageElem) {
      pageElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      const editorMain = document.querySelector('main');
      if (editorMain) editorMain.scrollTop = 0;
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-canvas font-sans text-ink">
      {/* Top Application Header */}
      <header className="h-11 border-b border-rule bg-panel px-4 flex items-center justify-between shrink-0 z-20 select-none">
        <div className="flex items-center gap-6">
          {/* Toggle Left Binder Sidebar */}
          <button
            onClick={() => setIsBinderOpen(!isBinderOpen)}
            className={`p-1 rounded transition-colors cursor-pointer ${
              !isBinderOpen ? 'text-editor-red' : 'text-graphite hover:text-ink'
            }`}
            title={isBinderOpen ? 'Hide Binder Sidebar' : 'Show Binder Sidebar'}
          >
            <PanelLeft className="w-4.5 h-4.5" />
          </button>

          <div className="flex items-center gap-3">
            <span className="text-[13px] font-medium tracking-tight text-ink truncate max-w-[240px]">
              {activeDoc?.title || 'Untitled'}
            </span>
            <div className="h-3 w-px bg-rule" />
            
            {/* Save & Cloud Sync Status Indicator */}
            <div className="flex items-center gap-1.5 text-[11px]" title="Auto-Save & Background Cloud Sync Status">
              {syncStatus === 'saving' && (
                <>
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-amber-600 dark:text-amber-400 font-medium">Saving...</span>
                </>
              )}
              {syncStatus === 'saved' && (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-700 dark:text-emerald-400 font-medium">Saved to Cloud</span>
                </>
              )}
              {syncStatus === 'offline' && (
                <>
                  <CloudOff className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-amber-600 dark:text-amber-400 font-medium">Offline - Saved Locally</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Global Toolbar Action Controls */}
        <div className="flex items-center gap-3">
          {/* PWA App Installation Button */}
          <PWAInstallButton />

          {/* Theme Mode Switcher */}
          <ThemeToggle />

          <div className="h-4 w-px bg-rule" />

          {/* Undo / Redo */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleUndo}
              disabled={!activeDoc || !getDocHistory(activeDoc.id).canUndo()}
              title="Undo"
              className="p-1 text-graphite hover:text-ink disabled:opacity-20 cursor-pointer transition-colors"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleRedo}
              disabled={!activeDoc || !getDocHistory(activeDoc.id).canRedo()}
              title="Redo"
              className="p-1 text-graphite hover:text-ink disabled:opacity-20 cursor-pointer transition-colors"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          <div className="h-4 w-px bg-rule" />

          {/* Unified Overflow Menu */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              className={`p-1 rounded transition-colors cursor-pointer ${isExportMenuOpen ? 'text-editor-red' : 'text-graphite hover:text-ink'}`}
              title="Document Actions"
            >
              <MoreHorizontal className="w-4.5 h-4.5" />
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-panel rounded-lg shadow-[0_10px_30px_rgba(0,0,0,0.12)] border border-rule py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                {activeDoc?.documentType === 'screenplay' && (
                  <>
                    <button
                      onClick={() => {
                        setIsExportMenuOpen(false);
                        handleOpenDocumentSettings('elements');
                      }}
                      className="w-full text-left px-4 py-1.5 text-[13px] hover:bg-neutral-100/50 flex items-center gap-3 text-ink cursor-pointer transition-colors"
                    >
                      <Settings className="w-4 h-4 text-graphite" />
                      <span>Document Settings</span>
                    </button>
                    <div className="h-px bg-rule my-2 mx-2" />
                  </>
                )}
                
                <div className="px-4 py-1 text-[10px] font-bold text-graphite opacity-60">
                  Export
                </div>

                <button
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    setIsPdfModalOpen(true);
                  }}
                  className="w-full text-left px-4 py-1.5 text-[13px] hover:bg-neutral-100/50 flex items-center justify-between group cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-editor-red" />
                    <span>PDF Document</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    handleExportFountain();
                  }}
                  disabled={!activeDoc || activeDoc.documentType !== 'screenplay'}
                  className="w-full text-left px-4 py-1.5 text-[13px] hover:bg-neutral-100/50 disabled:opacity-30 flex items-center justify-between group cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 text-ink">
                    <FileType className="w-4 h-4 text-graphite" />
                    <span>Fountain</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    handleExportFDX();
                  }}
                  disabled={!activeDoc}
                  className="w-full text-left px-4 py-1.5 text-[13px] hover:bg-neutral-100/50 disabled:opacity-30 flex items-center justify-between group cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 text-ink">
                    <FileCode className="w-4 h-4 text-graphite" />
                    <span>Final Draft (FDX)</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    handleExportMarkdown();
                  }}
                  disabled={!activeDoc}
                  className="w-full text-left px-4 py-1.5 text-[13px] hover:bg-neutral-100/50 disabled:opacity-30 flex items-center justify-between group cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 text-ink">
                    <FileText className="w-4 h-4 text-graphite" />
                    <span>Markdown</span>
                  </div>
                </button>

                <div className="h-px bg-rule my-2 mx-2" />
                
                <div className="px-4 py-1 text-[10px] font-bold text-graphite opacity-60">
                  View
                </div>
                
                <button
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    setIsInspectorOpen(!isInspectorOpen);
                  }}
                  className={`w-full text-left px-4 py-1.5 text-[13px] hover:bg-neutral-100/50 flex items-center gap-3 cursor-pointer transition-colors ${isInspectorOpen ? 'text-editor-red font-medium' : 'text-ink'}`}
                >
                  <PanelRight className="w-4 h-4 text-graphite" />
                  <span>Scene Inspector</span>
                  {isInspectorOpen && <Check className="w-3.5 h-3.5 ml-auto text-editor-red" />}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Multi-Panel Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Panel 1: Scrivener-Style Project Binder */}
        {project && isBinderOpen && (
          <Binder
            project={project}
            allProjects={allProjects}
            activeDocId={activeDoc?.id || null}
            onSelectDoc={handleSelectDocument}
            onSelectProject={handleSelectProject}
            onOpenHub={() => setIsHubModalOpen(true)}
            onUpdateProjectTitle={handleUpdateProjectTitle}
            onCreateNewProject={handleCreateNewProject}
            onCreateFolder={handleCreateFolder}
            onCreateDocument={handleCreateDocument}
            onDeleteItem={handleDeleteBinderItem}
            onRestoreItem={handleRestoreBinderItem}
            onPermanentDeleteItem={handlePermanentDeleteBinderItem}
            onEmptyTrash={handleEmptyTrash}
            onMoveItem={handleMoveBinderItem}
            onRenameItem={handleRenameItem}
            onReorderItem={handleReorderItem}
          />
        )}

        {/* Panel 2: Central Document Canvas */}
        <main className="flex-1 flex flex-col overflow-hidden bg-white border-l border-rule">
          {activeDoc?.documentType === 'screenplay' ? (
            <ScreenplayEditor
              document={activeDoc}
              caret={caret}
              formattingSettings={activeDoc.formattingSettings || DEFAULT_FORMATTING_SETTINGS}
              onOpenSettings={handleOpenDocumentSettings}
              onDispatchCommand={handleDispatchCommand}
              onCaretChange={setCaret}
              onUndo={handleUndo}
              onRedo={handleRedo}
              canUndo={activeDoc ? getDocHistory(activeDoc.id).canUndo() : false}
              canRedo={activeDoc ? getDocHistory(activeDoc.id).canRedo() : false}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
          ) : activeDoc ? (
            <ProseEditor
              document={activeDoc as ProseDocument}
              onUpdateDocument={(newDoc) => {
                setActiveDoc(newDoc);
                saveDocument(newDoc);
              }}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-graphite opacity-50">
              <FileCheck className="w-12 h-12 mb-4" />
              <p className="text-[13px]">Select or create a document in the binder.</p>
            </div>
          )}
        </main>

        {/* Panel 3: Page Previews & Production Sidebar (Screenplay Only, Toggleable) */}
        {activeDoc?.documentType === 'screenplay' && isInspectorOpen && (
          <PageThumbnailsPanel
            document={activeDoc}
            activeScene={activeScene}
            formattingSettings={activeDoc.formattingSettings || DEFAULT_FORMATTING_SETTINGS}
            pageFormat={activeDoc.formattingSettings?.paperFormat || 'US_LETTER'}
            onUpdateScene={handleUpdateSceneMeta}
            onJumpToPage={handleJumpToPage}
            onUpdateFormattingSettings={handleUpdateFormattingSettingsPartial}
          />
        )}
      </div>

      {/* PDF Export Modal */}
      <PdfModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        activeDoc={activeDoc?.documentType === 'screenplay' ? activeDoc : null}
      />

      {/* Studio Project Hub Modal */}
      <ProjectHubModal
        isOpen={isHubModalOpen}
        onClose={() => setIsHubModalOpen(false)}
        allProjects={allProjects}
        activeProjectId={project?.metadata.id || null}
        onSelectProject={handleSelectProject}
        onCreateNewProject={handleCreateNewProject}
        onDeleteProject={handleDeleteProject}
      />

      {/* Document & Format Settings Modal */}
      <DocumentSettingsModal
        isOpen={isDocumentSettingsOpen}
        onClose={() => setIsDocumentSettingsOpen(false)}
        documentTitle={activeDoc?.title || 'Untitled Screenplay'}
        settings={activeDoc?.documentType === 'screenplay' ? activeDoc.formattingSettings : undefined}
        onSaveSettings={handleSaveDocumentSettings}
        onOpenHub={() => setIsHubModalOpen(true)}
        initialTab={documentSettingsInitialTab}
      />

      {/* Bottom Status Bar */}
      <footer className="h-9 border-t border-rule bg-panel px-4 flex items-center justify-between shrink-0 z-20 select-none text-graphite">
        <div className="flex items-center gap-6">
          {activeDoc?.documentType === 'screenplay' && (
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-medium text-graphite">View Mode</span>
              <div className="flex items-center bg-neutral-100/30 dark:bg-neutral-800/30 rounded-md border border-rule p-0.5">
                <button
                  onClick={() => setViewMode('page')}
                  className={`px-3 py-1 text-[11px] font-medium rounded transition-all ${
                    viewMode === 'page'
                      ? 'bg-paper text-ink shadow-xs'
                      : 'text-graphite hover:text-ink'
                  }`}
                >
                  Page
                </button>
                <button
                  onClick={() => setViewMode('seamless')}
                  className={`px-3 py-1 text-[11px] font-medium rounded transition-all cursor-pointer ${
                    viewMode === 'seamless'
                      ? 'bg-paper text-ink shadow-xs font-semibold'
                      : 'text-graphite hover:text-ink'
                  }`}
                >
                  Seamless
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-6 text-[11px] font-medium">
          {activeDoc?.documentType === 'screenplay' && (
            <button
              onClick={handleTogglePaperFormat}
              className="flex items-center gap-1.5 hover:text-editor-red transition-colors cursor-pointer"
              title="Click to toggle between US Letter and A4 page format"
            >
              <span className="text-graphite opacity-60">Format:</span>
              <span className="text-ink font-semibold underline underline-offset-2 decoration-rule">
                {activeDoc.formattingSettings?.paperFormat?.replace('_', ' ') || 'US LETTER'}
              </span>
            </button>
          )}
          <div className="h-3 w-px bg-rule" />
          <div className="flex items-center gap-2">
            <span className="text-graphite opacity-60">Stats:</span>
            <span className="text-ink">
              {activeDoc?.nodes.reduce((acc, n) => acc + n.text.length, 0) || 0} chars
            </span>
          </div>
        </div>
      </footer>

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-12 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-panel border border-rule text-ink shadow-2xl text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
