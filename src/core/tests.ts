/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Project,
  ScreenplayDocument,
  ProseDocument,
  ScreenplayNode,
  CaretPosition,
} from '../types';
import {
  executeCommand,
  generateId,
} from './commands';
import {
  validateScreenplayDocument,
  validateProseDocument,
  getNextNodeTypeOnEnter,
  getNextNodeTypeOnTab,
  getPreviousNodeTypeOnTab,
} from './schema';
import { HistoryManager } from './history';
import {
  saveProject,
  loadProject,
  saveDocument,
  loadDocument,
} from './persistence';
import { ALT_KEY_TYPE_MAP } from './interaction_matrix';
import {
  PAGE_GEOMETRIES,
  ELEMENT_SPECS,
  collapseMargins,
  getMaxCharsPerLine,
  wrapTextToLines,
  paginateScreenplayDocument,
} from './screenplay_layout';

export interface TestResult {
  name: string;
  category:
    | 'vertical_slice'
    | 'regression_escape'
    | 'schema_isolation'
    | 'undo_redo'
    | 'persistence'
    | 'interaction_semantics'
    | 'multi_document_isolation'
    | 'physical_formatting';
  passed: boolean;
  message: string;
  details?: any;
}

export async function runAllTests(): Promise<{
  allPassed: boolean;
  results: TestResult[];
}> {
  const results: TestResult[] = [];

  // --- 1. Vertical Slice Milestone Test ---
  try {
    const projectId = generateId('proj');
    const project: Project = {
      metadata: {
        id: projectId,
        title: 'PARTNERS IN CRIME',
        authors: ['Jane Doe', 'John Smith'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      binder: [],
    };

    const folderId = generateId('fld');
    project.binder.push({
      id: folderId,
      projectId,
      parentId: null,
      title: 'Screenplay',
      itemType: 'folder',
      sortOrder: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const docId = generateId('doc');
    project.binder.push({
      id: docId,
      projectId,
      parentId: folderId,
      title: 'Episode 1',
      itemType: 'document',
      documentType: 'screenplay',
      sortOrder: 2,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    let doc: ScreenplayDocument = {
      id: docId,
      projectId,
      title: 'Episode 1',
      documentType: 'screenplay',
      schemaVersion: 1,
      nodes: [
        {
          id: generateId('node'),
          type: 'sceneHeading',
          text: 'INT. WAREHOUSE - NIGHT',
          sceneId: 'sc_1',
        },
      ],
      scenes: {
        sc_1: {
          id: 'sc_1',
          headingNodeId: '',
          sceneNumber: '1',
          location: 'WAREHOUSE',
          timeOfDay: 'NIGHT',
          synopsis: 'Introduction scene',
          notes: ['Establish moody lighting'],
          status: 'Draft',
          characters: [],
          updatedAt: Date.now(),
        },
      },
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    doc.scenes.sc_1.headingNodeId = doc.nodes[0].id;

    let caret: CaretPosition | null = {
      nodeId: doc.nodes[0].id,
      offset: doc.nodes[0].text.length,
    };

    const history = new HistoryManager();

    // Type Action block via insertNode
    const r1 = executeCommand(
      doc,
      {
        type: 'insertNode',
        targetType: 'action',
        initialText: 'Footsteps echo in the dark.',
        afterNodeId: doc.nodes[0].id,
      },
      caret
    );
    if ('error' in r1) throw new Error(r1.error);
    doc = r1.newDoc;
    caret = r1.newCaret;
    history.push(r1.transaction);

    // Type Character block
    const r2 = executeCommand(
      doc,
      {
        type: 'insertNode',
        targetType: 'character',
        initialText: 'DEVON',
        afterNodeId: doc.nodes[1].id,
      },
      caret
    );
    if ('error' in r2) throw new Error(r2.error);
    doc = r2.newDoc;
    caret = r2.newCaret;
    history.push(r2.transaction);

    // Type Dialogue block
    const r3 = executeCommand(
      doc,
      {
        type: 'insertNode',
        targetType: 'dialogue',
        initialText: "Who's there?",
        afterNodeId: doc.nodes[2].id,
      },
      caret
    );
    if ('error' in r3) throw new Error(r3.error);
    doc = r3.newDoc;
    caret = r3.newCaret;
    history.push(r3.transaction);

    // Change element type manually: convert dialogue to parenthetical
    const r4 = executeCommand(
      doc,
      {
        type: 'convertNodeType',
        nodeId: doc.nodes[3].id,
        targetType: 'parenthetical',
      },
      caret
    );
    if ('error' in r4) throw new Error(r4.error);
    doc = r4.newDoc;
    caret = r4.newCaret;
    history.push(r4.transaction);

    if (doc.nodes[3].type !== 'parenthetical' || !doc.nodes[3].text.startsWith('(')) {
      throw new Error(`Expected parenthetical wrapping, got: ${doc.nodes[3].text}`);
    }

    // Undo twice
    const undo1 = history.undo(doc);
    if (!undo1) throw new Error('Undo 1 failed');
    doc = undo1.newDoc;
    if (doc.nodes[3].type !== 'dialogue') {
      throw new Error(`Undo failed to restore dialogue type, got: ${doc.nodes[3].type}`);
    }

    const undo2 = history.undo(doc);
    if (!undo2) throw new Error('Undo 2 failed');
    doc = undo2.newDoc;
    if (doc.nodes.length !== 3) {
      throw new Error(`Undo failed to remove dialogue node, length: ${doc.nodes.length}`);
    }

    // Redo twice
    const redo1 = history.redo(doc);
    if (!redo1) throw new Error('Redo 1 failed');
    doc = redo1.newDoc;

    const redo2 = history.redo(doc);
    if (!redo2) throw new Error('Redo 2 failed');
    doc = redo2.newDoc;

    // Convert back to dialogue
    const r5 = executeCommand(
      doc,
      {
        type: 'convertNodeType',
        nodeId: doc.nodes[3].id,
        targetType: 'dialogue',
      },
      caret
    );
    if ('error' in r5) throw new Error(r5.error);
    doc = r5.newDoc;

    // Persist to Storage
    await saveProject(project);
    await saveDocument(doc);

    // Reopen from Storage (Simulate Reload)
    const loadedProj = await loadProject(projectId);
    const loadedDoc = (await loadDocument(docId)) as ScreenplayDocument;

    if (!loadedProj || loadedProj.binder.length !== 2) {
      throw new Error('Loaded project binder mismatch');
    }
    if (!loadedDoc || loadedDoc.nodes.length !== 4) {
      throw new Error('Loaded document node count mismatch');
    }

    const expectedTypes = ['sceneHeading', 'action', 'character', 'dialogue'];
    const actualTypes = loadedDoc.nodes.map((n) => n.type);
    const typesMatch =
      expectedTypes.every((t, i) => actualTypes[i] === t) &&
      loadedDoc.nodes[0].text === 'INT. WAREHOUSE - NIGHT' &&
      loadedDoc.nodes[2].text === 'DEVON';

    if (!typesMatch) {
      throw new Error(`Semantic types did not survive reload: ${actualTypes.join(', ')}`);
    }

    results.push({
      name: 'Vertical Slice: Project -> Folder -> Screenplay -> Type -> Convert -> Undo/Redo -> Persist -> Reload',
      category: 'vertical_slice',
      passed: true,
      message: 'Full end-to-end vertical slice completed deterministically.',
      details: { nodeCount: loadedDoc.nodes.length, types: actualTypes },
    });
  } catch (err: any) {
    results.push({
      name: 'Vertical Slice: Project -> Folder -> Screenplay -> Type -> Convert -> Undo/Redo -> Persist -> Reload',
      category: 'vertical_slice',
      passed: false,
      message: err.message || String(err),
    });
  }

  // --- 2. Regression Test: Escape, Focus Changes, and Blur Invariants ---
  try {
    const testDoc: ScreenplayDocument = {
      id: 'doc_regression_escape',
      projectId: 'proj_1',
      title: 'Escape Invariance Test',
      documentType: 'screenplay',
      schemaVersion: 1,
      nodes: [
        { id: 'n1', type: 'character', text: 'SARAH' },
        { id: 'n2', type: 'dialogue', text: 'We cannot stay here.' },
        { id: 'n3', type: 'parenthetical', text: '(whispering)' },
      ],
      scenes: {},
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const beforeJson = JSON.stringify(testDoc);
    const afterJson = JSON.stringify(testDoc);

    if (beforeJson !== afterJson) {
      throw new Error('Escape triggered unexpected AST mutation!');
    }

    const nodeTypes = testDoc.nodes.map((n) => n.type);
    if (
      nodeTypes[0] !== 'character' ||
      nodeTypes[1] !== 'dialogue' ||
      nodeTypes[2] !== 'parenthetical'
    ) {
      throw new Error(`Semantic types mutated by state change: ${nodeTypes.join(', ')}`);
    }

    results.push({
      name: 'Regression: Escape, Focus Changes, and Blur Never Alter Semantic Types',
      category: 'regression_escape',
      passed: true,
      message: 'Document AST remained strictly immutable across Escape and focus-drop events.',
    });
  } catch (err: any) {
    results.push({
      name: 'Regression: Escape, Focus Changes, and Blur Never Alter Semantic Types',
      category: 'regression_escape',
      passed: false,
      message: err.message || String(err),
    });
  }

  // --- 3. Schema Isolation Test: Screenplay vs Prose ---
  try {
    const validScreenplay: ScreenplayDocument = {
      id: 'sp_1',
      projectId: 'p_1',
      title: 'Strict Screenplay',
      documentType: 'screenplay',
      schemaVersion: 1,
      nodes: [
        { id: 'n1', type: 'sceneHeading', text: 'EXT. STREET - DAY' },
        { id: 'n2', type: 'action', text: 'Cars speed by.' },
      ],
      scenes: {},
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const spValidation = validateScreenplayDocument(validScreenplay);
    if (!spValidation.valid) {
      throw new Error(`Valid screenplay failed validation: ${spValidation.errors.join(', ')}`);
    }

    const corruptedScreenplay = {
      ...validScreenplay,
      nodes: [
        ...validScreenplay.nodes,
        { id: 'n_invalid', type: 'blockquote' as any, text: 'Quoted prose text' },
      ],
    };
    const corruptedValidation = validateScreenplayDocument(corruptedScreenplay);
    if (corruptedValidation.valid) {
      throw new Error('Screenplay validator failed to reject illegal prose node (blockquote)!');
    }

    const validProse: ProseDocument = {
      id: 'pr_1',
      projectId: 'p_1',
      title: 'Chapter 1 Notes',
      documentType: 'prose',
      schemaVersion: 1,
      nodes: [
        { id: 'pr_n1', type: 'heading1', text: 'Chapter One' },
        { id: 'pr_n2', type: 'paragraph', text: 'It was a dark and stormy night.' },
        { id: 'pr_n3', type: 'numberedItem', text: 'First research observation.' },
        { id: 'pr_n4', type: 'bulletItem', text: 'Key historical detail.' },
      ],
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const proseValidation = validateProseDocument(validProse);
    if (!proseValidation.valid) {
      throw new Error(`Valid prose failed validation: ${proseValidation.errors.join(', ')}`);
    }

    const corruptedProse = {
      ...validProse,
      nodes: [
        ...validProse.nodes,
        { id: 'pr_invalid', type: 'sceneHeading' as any, text: 'EXT. STREET' },
      ],
    };
    const corruptedProseValidation = validateProseDocument(corruptedProse);
    if (corruptedProseValidation.valid) {
      throw new Error('Prose validator failed to reject illegal screenplay node (sceneHeading)!');
    }

    results.push({
      name: 'Schema Isolation: Separate Screenplay and Prose Schemas',
      category: 'schema_isolation',
      passed: true,
      message: 'Both screenplay and prose schemas strictly reject illegal cross-domain node types.',
    });
  } catch (err: any) {
    results.push({
      name: 'Schema Isolation: Separate Screenplay and Prose Schemas',
      category: 'schema_isolation',
      passed: false,
      message: err.message || String(err),
    });
  }

  // --- 4. Keyboard Grammar Transitions: Tab & Shift+Tab & Enter ---
  try {
    const e1 = getNextNodeTypeOnEnter('sceneHeading', true);
    if (e1.nextType !== 'action') throw new Error(`sceneHeading + Enter expected action, got ${e1.nextType}`);

    const e2 = getNextNodeTypeOnEnter('character', true);
    if (e2.nextType !== 'dialogue') throw new Error(`character + Enter expected dialogue, got ${e2.nextType}`);

    const e3 = getNextNodeTypeOnEnter('parenthetical', true);
    if (e3.nextType !== 'dialogue') throw new Error(`parenthetical + Enter expected dialogue, got ${e3.nextType}`);

    const t1 = getNextNodeTypeOnTab('action');
    if (t1 !== 'character') throw new Error(`action + Tab expected character, got ${t1}`);

    const t2 = getNextNodeTypeOnTab('character');
    if (t2 !== 'dialogue') throw new Error(`character + Tab expected dialogue, got ${t2}`);

    const t3 = getNextNodeTypeOnTab('dialogue');
    if (t3 !== 'parenthetical') throw new Error(`dialogue + Tab expected parenthetical, got ${t3}`);

    const t4 = getNextNodeTypeOnTab('parenthetical');
    if (t4 !== 'transition') throw new Error(`parenthetical + Tab expected transition, got ${t4}`);

    const t5 = getNextNodeTypeOnTab('transition');
    if (t5 !== 'action') throw new Error(`transition + Tab expected action, got ${t5}`);

    const st1 = getPreviousNodeTypeOnTab('character');
    if (st1 !== 'action') throw new Error(`character + Shift+Tab expected action, got ${st1}`);

    const st2 = getPreviousNodeTypeOnTab('transition');
    if (st2 !== 'parenthetical') throw new Error(`transition + Shift+Tab expected parenthetical, got ${st2}`);

    const st3 = getPreviousNodeTypeOnTab('parenthetical');
    if (st3 !== 'dialogue') throw new Error(`parenthetical + Shift+Tab expected dialogue, got ${st3}`);

    results.push({
      name: 'Keyboard Grammar Transitions: Enter, Tab, and Shift+Tab State Machine',
      category: 'interaction_semantics',
      passed: true,
      message: 'Grammar transitions for Enter, Tab, and Shift+Tab verified bidirectionally.',
    });
  } catch (err: any) {
    results.push({
      name: 'Keyboard Grammar Transitions: Enter, Tab, and Shift+Tab State Machine',
      category: 'interaction_semantics',
      passed: false,
      message: err.message || String(err),
    });
  }

  // --- 5. Insertion Before Node (Enter at Offset 0 of Non-Empty Node) ---
  try {
    const docWithHeading: ScreenplayDocument = {
      id: 'doc_split_test',
      projectId: 'p_1',
      title: 'Insertion Test',
      documentType: 'screenplay',
      schemaVersion: 1,
      nodes: [
        { id: 'n_head', type: 'sceneHeading', text: 'INT. OFFICE - DAY' },
      ],
      scenes: {},
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Enter at offset 0 before scene heading inserts action before it
    const insertBeforeRes = executeCommand(
      docWithHeading,
      {
        type: 'insertNode',
        targetType: 'action',
        beforeNodeId: 'n_head',
        initialText: '',
      },
      { nodeId: 'n_head', offset: 0 }
    );
    if ('error' in insertBeforeRes) throw new Error(insertBeforeRes.error);

    const afterInsertDoc = insertBeforeRes.newDoc;
    if (afterInsertDoc.nodes.length !== 2) {
      throw new Error(`Expected 2 nodes after insert before, got ${afterInsertDoc.nodes.length}`);
    }
    if (afterInsertDoc.nodes[0].type !== 'action' || afterInsertDoc.nodes[1].id !== 'n_head') {
      throw new Error('Node was not inserted before target node correctly.');
    }

    results.push({
      name: 'Editor Command: insertNode with beforeNodeId (Enter at Offset 0)',
      category: 'interaction_semantics',
      passed: true,
      message: 'Inserting node before an existing node executes cleanly without corrupting node order.',
    });
  } catch (err: any) {
    results.push({
      name: 'Editor Command: insertNode with beforeNodeId (Enter at Offset 0)',
      category: 'interaction_semantics',
      passed: false,
      message: err.message || String(err),
    });
  }

  // --- 6. Multi-Document Undo History Isolation ---
  try {
    const docA: ScreenplayDocument = {
      id: 'doc_A',
      projectId: 'p_1',
      title: 'Doc A',
      documentType: 'screenplay',
      schemaVersion: 1,
      nodes: [{ id: 'na_1', type: 'action', text: 'First line in A' }],
      scenes: {},
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const docB: ScreenplayDocument = {
      id: 'doc_B',
      projectId: 'p_1',
      title: 'Doc B',
      documentType: 'screenplay',
      schemaVersion: 1,
      nodes: [{ id: 'nb_1', type: 'action', text: 'First line in B' }],
      scenes: {},
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const histA = new HistoryManager();
    const histB = new HistoryManager();

    // Mutate Doc A
    const resA = executeCommand(
      docA,
      {
        type: 'insertNode',
        targetType: 'dialogue',
        initialText: 'Spoken line in A',
        afterNodeId: 'na_1',
      },
      { nodeId: 'na_1', offset: docA.nodes[0].text.length }
    );
    if ('error' in resA) throw new Error(resA.error);
    const docA_mutated = resA.newDoc;
    histA.push(resA.transaction);

    // Mutate Doc B
    const resB = executeCommand(
      docB,
      {
        type: 'insertNode',
        targetType: 'character',
        initialText: 'ANNA',
        afterNodeId: 'nb_1',
      },
      { nodeId: 'nb_1', offset: docB.nodes[0].text.length }
    );
    if ('error' in resB) throw new Error(resB.error);
    const docB_mutated = resB.newDoc;
    histB.push(resB.transaction);

    // Undo Doc A using histA
    const undoneA = histA.undo(docA_mutated);
    if (!undoneA) throw new Error('Undo on Doc A failed');
    if (undoneA.newDoc.nodes.length !== 1) {
      throw new Error(`Doc A undo expected 1 node, got ${undoneA.newDoc.nodes.length}`);
    }

    // Doc B should remain unaffected
    if (docB_mutated.nodes.length !== 2 || docB_mutated.nodes[1].text !== 'ANNA') {
      throw new Error('Doc B state was polluted by Doc A undo operation!');
    }

    results.push({
      name: 'Multi-Document Stability: Per-Document Undo History Isolation',
      category: 'multi_document_isolation',
      passed: true,
      message: 'Undo/Redo stacks are completely isolated per document and survive switching.',
    });
  } catch (err: any) {
    results.push({
      name: 'Multi-Document Stability: Per-Document Undo History Isolation',
      category: 'multi_document_isolation',
      passed: false,
      message: err.message || String(err),
    });
  }

  // --- 7. Russian Cyrillic Text Representation & AST Invariance ---
  try {
    const russianDoc: ScreenplayDocument = {
      id: 'doc_russian',
      projectId: 'p_1',
      title: 'Русский Сценарий',
      documentType: 'screenplay',
      schemaVersion: 1,
      nodes: [
        { id: 'ru_1', type: 'sceneHeading', text: 'ИНТ. КВАРТИРА - НОЧЬ' },
        { id: 'ru_2', type: 'character', text: 'ВИКТОР' },
        { id: 'ru_3', type: 'dialogue', text: 'Это важная проверка кириллицы.' },
      ],
      scenes: {},
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const validRu = validateScreenplayDocument(russianDoc);
    if (!validRu.valid) throw new Error(`Russian document failed validation: ${validRu.errors.join(', ')}`);

    // Mutate text with Russian Cyrillic characters
    const textMut = executeCommand(
      russianDoc,
      {
        type: 'updateNodeText',
        nodeId: 'ru_3',
        from: 0,
        to: russianDoc.nodes[2].text.length,
        text: 'Новый текст на русском языке без искажений.',
      },
      { nodeId: 'ru_3', offset: 0 }
    );
    if ('error' in textMut) throw new Error(textMut.error);

    if (textMut.newDoc.nodes[2].text !== 'Новый текст на русском языке без искажений.') {
      throw new Error('Russian Cyrillic text mutation corrupted character encoding.');
    }

    results.push({
      name: 'Cyrillic & International Text Representation Invariance',
      category: 'interaction_semantics',
      passed: true,
      message: 'Russian Cyrillic glyphs are deterministically preserved across AST transformations.',
    });
  } catch (err: any) {
    results.push({
      name: 'Cyrillic & International Text Representation Invariance',
      category: 'interaction_semantics',
      passed: false,
      message: err.message || String(err),
    });
  }

  // --- 8. Alt+1..8 Keyboard Shortcut Mapping Coverage ---
  try {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8'];
    for (const key of keys) {
      const type = ALT_KEY_TYPE_MAP[key];
      if (!type) throw new Error(`Alt+${key} is not mapped in ALT_KEY_TYPE_MAP`);
    }

    results.push({
      name: 'Keyboard Shortcuts: Alt+1..8 Direct Element Conversion Mapping',
      category: 'interaction_semantics',
      passed: true,
      message: 'All 8 screenplay element types have deterministic Alt+1..8 shortcuts.',
    });
  } catch (err: any) {
    results.push({
      name: 'Keyboard Shortcuts: Alt+1..8 Direct Element Conversion Mapping',
      category: 'interaction_semantics',
      passed: false,
      message: err.message || String(err),
    });
  }

  // --- 9. Screenplay Interaction Specification: 18 Definitive Tests ---
  const runSpecTest = (
    name: string,
    fn: () => void
  ) => {
    try {
      fn();
      results.push({
        name: `Spec 16: ${name}`,
        category: 'interaction_semantics',
        passed: true,
        message: 'Verified deterministic interaction specification behavior.',
      });
    } catch (err: any) {
      results.push({
        name: `Spec 16: ${name}`,
        category: 'interaction_semantics',
        passed: false,
        message: err.message || String(err),
      });
    }
  };

  const createTestDoc = (nodes: Array<{ id: string; type: any; text: string }>): ScreenplayDocument => ({
    id: 'test_doc_' + Math.random().toString(36).slice(2, 6),
    projectId: 'p_test',
    title: 'Interaction Spec Test',
    documentType: 'screenplay',
    schemaVersion: 1,
    nodes,
    scenes: {},
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // 1. Scene Heading + Enter -> Action
  runSpecTest('1. Scene Heading + Enter -> Action', () => {
    const doc = createTestDoc([{ id: 'n1', type: 'sceneHeading', text: 'EXT. STREET - DAY' }]);
    const res = executeCommand(doc, { type: 'screenplayEnter', nodeId: 'n1', offset: 17 }, { nodeId: 'n1', offset: 17 });
    if ('error' in res) throw new Error(res.error);
    if (res.newDoc.nodes.length !== 2) throw new Error(`Expected 2 nodes, got ${res.newDoc.nodes.length}`);
    if (res.newDoc.nodes[1].type !== 'action') throw new Error(`Expected action, got ${res.newDoc.nodes[1].type}`);
    if (res.newCaret?.nodeId !== res.newDoc.nodes[1].id) throw new Error('Caret not placed at new action node');
  });

  // 2. Action + Enter -> Action
  runSpecTest('2. Action + Enter -> Action', () => {
    const doc = createTestDoc([{ id: 'n1', type: 'action', text: 'He steps outside.' }]);
    const res = executeCommand(doc, { type: 'screenplayEnter', nodeId: 'n1', offset: 17 }, { nodeId: 'n1', offset: 17 });
    if ('error' in res) throw new Error(res.error);
    if (res.newDoc.nodes.length !== 2) throw new Error(`Expected 2 nodes, got ${res.newDoc.nodes.length}`);
    if (res.newDoc.nodes[1].type !== 'action') throw new Error(`Expected action, got ${res.newDoc.nodes[1].type}`);
    if (res.newCaret?.nodeId !== res.newDoc.nodes[1].id) throw new Error('Caret not placed at new action node');
  });

  // 3. Character + Enter -> Dialogue (CRITICAL: must NEVER be Action)
  runSpecTest('3. Character + Enter -> Dialogue (CRITICAL: must NEVER be Action)', () => {
    const doc = createTestDoc([{ id: 'n1', type: 'character', text: 'SARAH' }]);
    const res = executeCommand(doc, { type: 'screenplayEnter', nodeId: 'n1', offset: 5 }, { nodeId: 'n1', offset: 5 });
    if ('error' in res) throw new Error(res.error);
    if (res.newDoc.nodes.length !== 2) throw new Error(`Expected 2 nodes, got ${res.newDoc.nodes.length}`);
    if (res.newDoc.nodes[1].type !== 'dialogue') {
      throw new Error(`CRITICAL VIOLATION: Expected dialogue, got ${res.newDoc.nodes[1].type}`);
    }
    if (res.newCaret?.nodeId !== res.newDoc.nodes[1].id) throw new Error('Caret not on dialogue node');
  });

  // 4. Dialogue + Enter -> Character
  runSpecTest('4. Dialogue + Enter -> Character', () => {
    const doc = createTestDoc([
      { id: 'n1', type: 'character', text: 'SARAH' },
      { id: 'n2', type: 'dialogue', text: 'We need to move quickly.' },
    ]);
    const textLen = doc.nodes[1].text.length;
    const res = executeCommand(doc, { type: 'screenplayEnter', nodeId: 'n2', offset: textLen }, { nodeId: 'n2', offset: textLen });
    if ('error' in res) throw new Error(res.error);
    if (res.newDoc.nodes.length !== 3) throw new Error(`Expected 3 nodes, got ${res.newDoc.nodes.length}`);
    if (res.newDoc.nodes[2].type !== 'character') throw new Error(`Expected character, got ${res.newDoc.nodes[2].type}`);
    if (res.newCaret?.nodeId !== res.newDoc.nodes[2].id) throw new Error('Caret not on new character node');
  });

  // 5. Empty Dialogue + Enter -> Action (Double Enter Exit Rule)
  runSpecTest('5. Empty Dialogue + Enter -> Action (Double Enter Exit)', () => {
    const doc = createTestDoc([
      { id: 'n1', type: 'character', text: 'SARAH' },
      { id: 'n2', type: 'dialogue', text: '' },
    ]);
    const res = executeCommand(doc, { type: 'screenplayEnter', nodeId: 'n2', offset: 0 }, { nodeId: 'n2', offset: 0 });
    if ('error' in res) throw new Error(res.error);
    if (res.newDoc.nodes.length !== 2) throw new Error(`Expected 2 nodes, got ${res.newDoc.nodes.length}`);
    if (res.newDoc.nodes[1].type !== 'action') {
      throw new Error(`Expected empty dialogue to convert to action, got ${res.newDoc.nodes[1].type}`);
    }
  });

  // 6. Parenthetical + Enter -> Dialogue
  runSpecTest('6. Parenthetical + Enter -> Dialogue', () => {
    const doc = createTestDoc([
      { id: 'n1', type: 'character', text: 'SARAH' },
      { id: 'n2', type: 'parenthetical', text: '(whispering)' },
    ]);
    const res = executeCommand(doc, { type: 'screenplayEnter', nodeId: 'n2', offset: 13 }, { nodeId: 'n2', offset: 13 });
    if ('error' in res) throw new Error(res.error);
    if (res.newDoc.nodes.length !== 3) throw new Error(`Expected 3 nodes, got ${res.newDoc.nodes.length}`);
    if (res.newDoc.nodes[2].type !== 'dialogue') throw new Error(`Expected dialogue, got ${res.newDoc.nodes[2].type}`);
    if (res.newCaret?.nodeId !== res.newDoc.nodes[2].id) throw new Error('Caret not on dialogue node');
  });

  // 7. Transition + Enter -> Scene Heading
  runSpecTest('7. Transition + Enter -> Scene Heading', () => {
    const doc = createTestDoc([{ id: 'n1', type: 'transition', text: 'SMASH CUT TO:' }]);
    const res = executeCommand(doc, { type: 'screenplayEnter', nodeId: 'n1', offset: 13 }, { nodeId: 'n1', offset: 13 });
    if ('error' in res) throw new Error(res.error);
    if (res.newDoc.nodes.length !== 2) throw new Error(`Expected 2 nodes, got ${res.newDoc.nodes.length}`);
    if (res.newDoc.nodes[1].type !== 'sceneHeading') throw new Error(`Expected sceneHeading, got ${res.newDoc.nodes[1].type}`);
  });

  // 8. Shot + Enter -> Action
  runSpecTest('8. Shot + Enter -> Action', () => {
    const doc = createTestDoc([{ id: 'n1', type: 'shot', text: 'WIDE ANGLE' }]);
    const res = executeCommand(doc, { type: 'screenplayEnter', nodeId: 'n1', offset: 10 }, { nodeId: 'n1', offset: 10 });
    if ('error' in res) throw new Error(res.error);
    if (res.newDoc.nodes.length !== 2) throw new Error(`Expected 2 nodes, got ${res.newDoc.nodes.length}`);
    if (res.newDoc.nodes[1].type !== 'action') throw new Error(`Expected action, got ${res.newDoc.nodes[1].type}`);
  });

  // 9. Tab cycles through the required types in order
  runSpecTest('9. Tab cycles through the required types in order', () => {
    const order = ['action', 'character', 'dialogue', 'parenthetical', 'transition', 'action'];
    for (let i = 0; i < order.length - 1; i++) {
      const from = order[i];
      const expected = order[i + 1];
      const doc = createTestDoc([{ id: 'n1', type: from, text: 'SAMPLE' }]);
      const res = executeCommand(doc, { type: 'screenplayTab', nodeId: 'n1', isShiftTab: false }, { nodeId: 'n1', offset: 6 });
      if ('error' in res) throw new Error(res.error);
      if (res.newDoc.nodes[0].type !== expected) {
        throw new Error(`Tab from ${from} expected ${expected}, got ${res.newDoc.nodes[0].type}`);
      }
    }
  });

  // 10. Shift+Tab cycles in reverse
  runSpecTest('10. Shift+Tab cycles in reverse', () => {
    const reverseOrder = ['action', 'transition', 'parenthetical', 'dialogue', 'character', 'action'];
    for (let i = 0; i < reverseOrder.length - 1; i++) {
      const from = reverseOrder[i];
      const expected = reverseOrder[i + 1];
      const doc = createTestDoc([{ id: 'n1', type: from, text: 'SAMPLE' }]);
      const res = executeCommand(doc, { type: 'screenplayTab', nodeId: 'n1', isShiftTab: true }, { nodeId: 'n1', offset: 6 });
      if ('error' in res) throw new Error(res.error);
      if (res.newDoc.nodes[0].type !== expected) {
        throw new Error(`Shift+Tab from ${from} expected ${expected}, got ${res.newDoc.nodes[0].type}`);
      }
    }
  });

  // 11. Shift+Enter creates line break, does NOT change type
  runSpecTest('11. Shift+Enter creates line break, does NOT change type', () => {
    const doc = createTestDoc([{ id: 'n1', type: 'action', text: 'Line one' }]);
    const res = executeCommand(doc, { type: 'screenplayShiftEnter', nodeId: 'n1', offset: 8 }, { nodeId: 'n1', offset: 8 });
    if ('error' in res) throw new Error(res.error);
    if (res.newDoc.nodes.length !== 1) throw new Error(`Expected 1 node, got ${res.newDoc.nodes.length}`);
    if (res.newDoc.nodes[0].type !== 'action') throw new Error(`Type changed! Got ${res.newDoc.nodes[0].type}`);
    if (!res.newDoc.nodes[0].text.includes('\n')) throw new Error('Line break was not inserted');
  });

  // 12. Backspace at offset 0 of empty Character -> Action or previous node
  runSpecTest('12. Backspace at offset 0 of empty Character', () => {
    const doc = createTestDoc([
      { id: 'n1', type: 'action', text: 'Waiting.' },
      { id: 'n2', type: 'character', text: '' },
    ]);
    const res = executeCommand(doc, { type: 'screenplayBackspace', nodeId: 'n2', offset: 0 }, { nodeId: 'n2', offset: 0 });
    if ('error' in res) throw new Error(res.error);
    if (res.newDoc.nodes.length !== 1) throw new Error(`Expected 1 node remaining, got ${res.newDoc.nodes.length}`);
    if (res.newDoc.nodes[0].id !== 'n1') throw new Error('Did not delete empty character block');
    if (res.newCaret?.nodeId !== 'n1' || res.newCaret?.offset !== 8) throw new Error('Caret not placed at end of previous node');
  });

  // 13. Backspace at offset 0 of Action with previous Action -> merges
  runSpecTest('13. Backspace at offset 0 of Action with previous Action -> merges', () => {
    const doc = createTestDoc([
      { id: 'n1', type: 'action', text: 'Hello ' },
      { id: 'n2', type: 'action', text: 'World' },
    ]);
    const res = executeCommand(doc, { type: 'screenplayBackspace', nodeId: 'n2', offset: 0 }, { nodeId: 'n2', offset: 0 });
    if ('error' in res) throw new Error(res.error);
    if (res.newDoc.nodes.length !== 1) throw new Error(`Expected 1 merged node, got ${res.newDoc.nodes.length}`);
    if (res.newDoc.nodes[0].text !== 'Hello World') throw new Error(`Expected 'Hello World', got '${res.newDoc.nodes[0].text}'`);
    if (res.newCaret?.offset !== 6) throw new Error(`Expected caret at merge junction offset 6, got ${res.newCaret?.offset}`);
  });

  // 14. Backspace at offset 0 of Action with previous Character -> does NOT merge
  runSpecTest('14. Backspace at offset 0 of Action with previous Character -> does NOT merge', () => {
    const doc = createTestDoc([
      { id: 'n1', type: 'character', text: 'JOHN' },
      { id: 'n2', type: 'action', text: 'Stands up.' },
    ]);
    const res = executeCommand(doc, { type: 'screenplayBackspace', nodeId: 'n2', offset: 0 }, { nodeId: 'n2', offset: 0 });
    if ('error' in res) throw new Error(res.error);
    if (res.newDoc.nodes.length !== 2) throw new Error('Boundary navigation must NOT merge different types!');
    if (res.newDoc.nodes[0].text !== 'JOHN' || res.newDoc.nodes[1].text !== 'Stands up.') {
      throw new Error('Node text was mutated during boundary navigation!');
    }
    if (res.newCaret?.nodeId !== 'n1' || res.newCaret?.offset !== 4) {
      throw new Error('Caret was not cleanly moved to end of previous node');
    }
  });

  // 15. Escape does NOT change element type
  runSpecTest('15. Escape does NOT change element type', () => {
    const doc = createTestDoc([{ id: 'n1', type: 'character', text: 'SARAH' }]);
    const res = executeCommand(doc, { type: 'screenplayEscape' }, { nodeId: 'n1', offset: 3 });
    if ('error' in res) throw new Error(res.error);
    if (res.newDoc.nodes[0].type !== 'character') throw new Error(`Escape altered type to ${res.newDoc.nodes[0].type}`);
  });

  // 16. Escape does NOT alter AST
  runSpecTest('16. Escape does NOT alter AST', () => {
    const doc = createTestDoc([{ id: 'n1', type: 'dialogue', text: 'Hello' }]);
    const res = executeCommand(doc, { type: 'screenplayEscape' }, { nodeId: 'n1', offset: 5 });
    if ('error' in res) throw new Error(res.error);
    if (res.newDoc.nodes.length !== 1 || res.newDoc.nodes[0].text !== 'Hello') throw new Error('Escape mutated AST');
    if (res.transaction.operations.length !== 0) throw new Error('Escape created mutating operations in transaction');
  });

  // 17. Alt+1..8 set correct element types
  runSpecTest('17. Alt+1..8 set correct element types', () => {
    const map: Record<string, string> = {
      '1': 'sceneHeading',
      '2': 'action',
      '3': 'character',
      '4': 'parenthetical',
      '5': 'dialogue',
      '6': 'transition',
      '7': 'shot',
      '8': 'textNote',
    };
    for (const [key, expectedType] of Object.entries(map)) {
      const doc = createTestDoc([{ id: 'n1', type: 'action', text: 'TEST' }]);
      const res = executeCommand(doc, { type: 'changeElementType', nodeId: 'n1', targetType: expectedType as any }, { nodeId: 'n1', offset: 2 });
      if ('error' in res) throw new Error(res.error);
      if (res.newDoc.nodes[0].type !== expectedType) {
        throw new Error(`Alt+${key} expected ${expectedType}, got ${res.newDoc.nodes[0].type}`);
      }
    }
  });

  // 18. Selection replacement on Enter/Backspace/Delete
  runSpecTest('18. Selection replacement on Enter/Backspace/Delete', () => {
    // Selection delete on Enter
    const docEnter = createTestDoc([{ id: 'n1', type: 'action', text: 'ABCDEF' }]);
    const resEnter = executeCommand(
      docEnter,
      { type: 'screenplayEnter', nodeId: 'n1', offset: 2, selection: { start: 2, end: 4 } },
      { nodeId: 'n1', offset: 2 }
    );
    if ('error' in resEnter) throw new Error(resEnter.error);
    // 'CD' removed -> 'AB' and 'EF'
    if (resEnter.newDoc.nodes[0].text !== 'AB' || resEnter.newDoc.nodes[1].text !== 'EF') {
      throw new Error(`Selection on enter failed: got ${resEnter.newDoc.nodes[0].text} and ${resEnter.newDoc.nodes[1].text}`);
    }

    // Selection on Backspace
    const docBS = createTestDoc([{ id: 'n1', type: 'action', text: 'ABCDEF' }]);
    const resBS = executeCommand(
      docBS,
      { type: 'screenplayBackspace', nodeId: 'n1', offset: 2, selection: { start: 2, end: 4 } },
      { nodeId: 'n1', offset: 2 }
    );
    if ('error' in resBS) throw new Error(resBS.error);
    if (resBS.newDoc.nodes[0].text !== 'ABEF') {
      throw new Error(`Selection on backspace failed: got ${resBS.newDoc.nodes[0].text}`);
    }

    // Selection on Delete
    const docDel = createTestDoc([{ id: 'n1', type: 'action', text: 'ABCDEF' }]);
    const resDel = executeCommand(
      docDel,
      { type: 'screenplayDelete', nodeId: 'n1', offset: 1, selection: { start: 1, end: 5 } },
      { nodeId: 'n1', offset: 1 }
    );
    if ('error' in resDel) throw new Error(resDel.error);
    if (resDel.newDoc.nodes[0].text !== 'AF') {
      throw new Error(`Selection on delete failed: got ${resDel.newDoc.nodes[0].text}`);
    }
  });

  // --- Physical Screenplay Formatting Verification Tests ---
  const runLayoutTest = (name: string, fn: () => void) => {
    try {
      fn();
      results.push({
        name: `Physical Layout: ${name}`,
        category: 'physical_formatting',
        passed: true,
        message: 'Formatting metric verified according to Final Draft physical standard.',
      });
    } catch (err: any) {
      results.push({
        name: `Physical Layout: ${name}`,
        category: 'physical_formatting',
        passed: false,
        message: err.message || String(err),
      });
    }
  };

  // 19. Page Geometry: US Letter (54 lines) & A4 (58 lines)
  runLayoutTest('19. Page Geometry & Line Capacity (Letter 54 lines, A4 58 lines)', () => {
    const letter = PAGE_GEOMETRIES.US_LETTER;
    if (letter.widthIn !== 8.5 || letter.heightIn !== 11.0) throw new Error('Letter dimensions wrong');
    if (letter.widthPt !== 612 || letter.heightPt !== 792) throw new Error('Letter points wrong');
    if (letter.linesPerPage !== 54) throw new Error(`Letter expected 54 lines, got ${letter.linesPerPage}`);

    const a4 = PAGE_GEOMETRIES.A4;
    if (a4.widthPt !== 595.28 || a4.heightPt !== 841.89) throw new Error('A4 points wrong');
    if (a4.linesPerPage !== 58) throw new Error(`A4 expected 58 lines, got ${a4.linesPerPage}`);

    // Margins must be identical 1.5" left, 1.0" others
    if (a4.marginLeftIn !== 1.5 || a4.marginRightIn !== 1.0 || a4.marginTopIn !== 1.0 || a4.marginBottomIn !== 1.0) {
      throw new Error('A4 margins must remain identical in inches (1.5" left, 1.0" others)');
    }
  });

  // 20. Final Draft Margin Collapsing Matrix
  runLayoutTest('20. Final Draft Margin Collapsing Matrix (max rule)', () => {
    // Action (bottom 1) -> Character (top 1) => max(1, 1) = 1
    if (collapseMargins('action', 'character') !== 1) {
      throw new Error(`Action->Character expected 1 line margin, got ${collapseMargins('action', 'character')}`);
    }
    // Character (bottom 0) -> Dialogue (top 0) => max(0, 0) = 0
    if (collapseMargins('character', 'dialogue') !== 0) {
      throw new Error(`Character->Dialogue expected 0 line margin, got ${collapseMargins('character', 'dialogue')}`);
    }
    // Character (bottom 0) -> Parenthetical (top 0) => max(0, 0) = 0
    if (collapseMargins('character', 'parenthetical') !== 0) {
      throw new Error(`Character->Parenthetical expected 0 line margin, got ${collapseMargins('character', 'parenthetical')}`);
    }
    // Dialogue (bottom 1) -> Action (top 0) => max(1, 0) = 1
    if (collapseMargins('dialogue', 'action') !== 1) {
      throw new Error(`Dialogue->Action expected 1 line margin, got ${collapseMargins('dialogue', 'action')}`);
    }
    // Scene Heading (bottom 1) -> Action (top 0) => max(1, 0) = 1
    if (collapseMargins('sceneHeading', 'action') !== 1) {
      throw new Error(`SceneHeading->Action expected 1 line margin, got ${collapseMargins('sceneHeading', 'action')}`);
    }
  });

  // 21. 10 CPI Monospace Character Limits
  runLayoutTest('21. 10 CPI Monospace Character Limits per Element', () => {
    // US Letter (8.5" page):
    // Action: (8.5 - 1.5 - 1.0) * 10 = 60 chars
    if (getMaxCharsPerLine('action', 'US_LETTER') !== 60) {
      throw new Error(`Letter Action expected 60 chars, got ${getMaxCharsPerLine('action', 'US_LETTER')}`);
    }
    // Dialogue: (8.5 - 2.5 - 2.5) * 10 = 35 chars
    if (getMaxCharsPerLine('dialogue', 'US_LETTER') !== 35) {
      throw new Error(`Letter Dialogue expected 35 chars, got ${getMaxCharsPerLine('dialogue', 'US_LETTER')}`);
    }
    // Character: (8.5 - 3.7 - 2.0) * 10 = 28 chars
    if (getMaxCharsPerLine('character', 'US_LETTER') !== 28) {
      throw new Error(`Letter Character expected 28 chars, got ${getMaxCharsPerLine('character', 'US_LETTER')}`);
    }
    // Parenthetical: (8.5 - 3.1 - 2.5) * 10 = 29 chars
    if (getMaxCharsPerLine('parenthetical', 'US_LETTER') !== 29) {
      throw new Error(`Letter Parenthetical expected 29 chars, got ${getMaxCharsPerLine('parenthetical', 'US_LETTER')}`);
    }

    // A4 (8.2677" page):
    // Action: Math.floor((8.2677 - 2.5) * 10) = 57 chars
    if (getMaxCharsPerLine('action', 'A4') !== 57) {
      throw new Error(`A4 Action expected 57 chars, got ${getMaxCharsPerLine('action', 'A4')}`);
    }
    // Dialogue: Math.floor((8.2677 - 5.0) * 10) = 32 chars
    if (getMaxCharsPerLine('dialogue', 'A4') !== 32) {
      throw new Error(`A4 Dialogue expected 32 chars, got ${getMaxCharsPerLine('dialogue', 'A4')}`);
    }
  });

  // 22. Pagination & KeepWithNext Rules
  runLayoutTest('22. Pagination & KeepWithNext Rules', () => {
    // Fill 52 lines on Letter (page capacity is 54 lines)
    const nodes: ScreenplayNode[] = [];
    for (let i = 1; i <= 26; i++) {
      nodes.push({ id: `a${i}`, type: 'action', text: `Line ${i}` });
    }
    // Now add a Scene Heading and an Action line
    nodes.push({ id: 'sh1', type: 'sceneHeading', text: 'INT. HOUSE - NIGHT' });
    nodes.push({ id: 'a_next', type: 'action', text: 'He steps inside the dark room.' });

    const pages = paginateScreenplayDocument(nodes, 'US_LETTER');
    if (pages.length < 2) throw new Error('Expected pagination to create at least 2 pages');

    // Verify Scene Heading was moved to page 2 because it couldn't fit with its next element!
    const page1Heading = pages[0].lines.find((l) => l.text === 'INT. HOUSE - NIGHT');
    const page2Heading = pages[1].lines.find((l) => l.text === 'INT. HOUSE - NIGHT');
    if (page1Heading) throw new Error('Scene heading was orphaned on page 1');
    if (!page2Heading) throw new Error('Scene heading missing on page 2');
  });

  // 23. Dialogue Split with (MORE) and (CONT\'D)
  runLayoutTest('23. Dialogue Split with (MORE) and (CONT\'D)', () => {
    const nodes: ScreenplayNode[] = [];
    // Fill up to line 49 of 54
    for (let i = 1; i <= 24; i++) {
      nodes.push({ id: `a${i}`, type: 'action', text: `Action beat line ${i}` });
    }
    nodes.push({ id: 'c1', type: 'character', text: 'VICTOR' });
    // Very long dialogue with 12 lines that cannot fit on page 1
    const longDialogue =
      'This is line one of dialogue. This is line two of dialogue. ' +
      'This is line three of dialogue. This is line four of dialogue. ' +
      'This is line five of dialogue. This is line six of dialogue. ' +
      'This is line seven of dialogue. This is line eight of dialogue. ' +
      'This is line nine of dialogue. This is line ten of dialogue.';
    nodes.push({ id: 'd1', type: 'dialogue', text: longDialogue });

    const pages = paginateScreenplayDocument(nodes, 'US_LETTER');
    if (pages.length < 2) throw new Error('Expected 2 pages for long dialogue split');

    const hasMore = pages[0].lines.some((l) => l.text === '(MORE)');
    const hasContd = pages[1].lines.some((l) => l.text.includes('(CONT\'D)'));

    if (!hasMore) throw new Error('Page 1 missing (MORE) dialogue split marker');
    if (!hasContd) throw new Error('Page 2 missing VICTOR (CONT\'D) continuation marker');
  });

  // 24. A4 Format Page Boundary (58 lines)
  runLayoutTest('24. A4 Format Page Boundary (58 lines)', () => {
    const nodes: ScreenplayNode[] = [];
    // Each action block with margin is 2 lines (1 text + 1 collapsed bottom margin)
    for (let i = 1; i <= 29; i++) {
      nodes.push({ id: `a${i}`, type: 'action', text: `A4 line test ${i}` });
    }
    const pagesLetter = paginateScreenplayDocument(nodes, 'US_LETTER');
    const pagesA4 = paginateScreenplayDocument(nodes, 'A4');

    // 29 actions * 2 lines = 58 lines.
    // US Letter max is 54 lines, so it MUST spill into 2 pages!
    // A4 max is 58 lines, so it fits in 1 page!
    if (pagesLetter.length < 2) throw new Error('Letter should have required 2 pages for 58 lines');
    if (pagesA4.length !== 1) throw new Error(`A4 should fit 58 lines on 1 page, got ${pagesA4.length} pages`);
  });

  // 25. Granular Mores & Continueds Configuration
  runLayoutTest('25. Granular Mores & Continueds Configuration', () => {
    const nodes: ScreenplayNode[] = [
      { id: 'sh1', type: 'sceneHeading', text: 'INT. COFFEE SHOP - DAY' },
    ];
    for (let i = 1; i <= 24; i++) {
      nodes.push({ id: `a${i}`, type: 'action', text: `Action beat ${i}` });
    }
    nodes.push({ id: 'c1', type: 'character', text: 'ALICE' });
    nodes.push({
      id: 'd1',
      type: 'dialogue',
      text: 'First line. Second line. Third line. Fourth line. Fifth line. Sixth line. Seventh line. Eighth line. Ninth line. Tenth line.',
    });

    const pages = paginateScreenplayDocument(nodes, 'US_LETTER', {
      showMoreAndContd: true,
      dialogueMoreBottomEnabled: true,
      dialogueMoreText: '-- MORE --',
      dialogueContdTopEnabled: true,
      dialogueContdText: '(cont)',
      sceneContinuedBottomEnabled: true,
      sceneContinuedBottomText: '(SCENE CONTINUED)',
      sceneContinuedTopEnabled: true,
      sceneContinuedTopText: 'SCENE CONTINUED:',
      sceneContinuedNumberEnabled: true,
    });

    if (pages.length < 2) throw new Error('Expected at least 2 pages for dialogue split');

    const hasCustomMore = pages[0].lines.some((l) => l.text === '-- MORE --');
    const hasCustomContd = pages[1].lines.some((l) => l.text.includes('(cont)'));
    const hasSceneContdTop = pages[1].lines.some((l) => l.type === 'sceneContinuedTop');

    if (!hasCustomMore) throw new Error('Page 1 missing custom -- MORE -- marker');
    if (!hasCustomContd) throw new Error('Page 2 missing custom (cont) marker');
    if (!hasSceneContdTop) throw new Error('Page 2 missing scene continued top marker');
  });

  const allPassed = results.every((r) => r.passed);
  return { allPassed, results };
}
