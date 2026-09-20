/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// --- Domain Model: Workspace & Project Hierarchy ---

export type ItemType = 'folder' | 'document';

export type DocumentType =
  | 'screenplay'
  | 'prose'
  | 'richNote'
  | 'plainNote'
  | 'reference';

export interface BinderItem {
  id: string;
  projectId: string;
  parentId: string | null; // null for root items
  title: string;
  itemType: ItemType;
  documentType?: DocumentType; // defined if itemType === 'document'
  sortOrder: number;
  trashed?: boolean;
  trashedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectMetadata {
  id: string;
  title: string;
  authors: string[];
  revisionTag?: string;
  copyright?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Project {
  metadata: ProjectMetadata;
  binder: BinderItem[];
}

// --- Screenplay Domain & Document Model ---

export type ScreenplayNodeType =
  | 'sceneHeading'
  | 'action'
  | 'character'
  | 'parenthetical'
  | 'dialogue'
  | 'transition'
  | 'shot'
  | 'textNote'
  | 'newAct'
  | 'endOfAct'
  | 'outline';

export interface ScreenplayNode {
  id: string;
  type: ScreenplayNodeType;
  text: string;
  sceneId?: string;
  attrs?: {
    sceneNumber?: string;
    sceneTime?: string;
    sceneLocation?: string;
    modifier?: string; // e.g. V.O., O.S., CONT'D
    isDualDialogue?: boolean;
    dualSide?: 'left' | 'right' | 'none';
    noteColor?: string;
    [key: string]: any;
  };
}

export interface SceneMetadata {
  id: string; // matches sceneId on ScreenplayNode
  headingNodeId: string;
  sceneNumber: string;
  location: string;
  timeOfDay: string;
  synopsis: string;
  notes: string[];
  status: 'Draft' | 'Revised' | 'Locked' | 'Review';
  characters: string[];
  updatedAt: number;
}

export type SceneHeadingStyle = 'bold' | 'normal' | 'underline' | 'boldUnderline';
export type FontFamilyOption = 'courier_prime' | 'courier_new' | 'pt_mono' | 'times' | 'georgia';

export interface ElementStyleConfig {
  fontWeight: 'normal' | 'bold';
  textDecoration: 'none' | 'underline';
  fontStyle: 'normal' | 'italic';
  uppercase: boolean;
  align?: 'left' | 'center' | 'right';
  lineSpacing?: number; // 1, 1.5, 2
  spaceBefore?: number; // 0, 1, 2
  leftMarginIn?: number;
  rightMarginIn?: number;
  fontFamily?: string;
  fontSizePt?: number;
  color?: string;
  nextElementType?: ScreenplayNodeType;
}

export type ScreenplayElementType = ScreenplayNodeType;

export type ElementStylesSettings = Record<ScreenplayNodeType, ElementStyleConfig>;

export interface TitlePageSettings {
  title: string;
  subtitle?: string;
  writtenBy?: string;
  basedOn?: string;
  contactInfo?: string;
  draftDate?: string;
  revisionTag?: string;
  copyright?: string;
  showTitlePage: boolean;
}

export interface ColorSettings {
  backgroundColor: string;
  paperColor: string;
  textColor: string;
  invisiblesColor: string;
  useSystemColors: boolean;
}

export const DEFAULT_COLOR_SETTINGS: ColorSettings = {
  backgroundColor: 'var(--canvas)',
  paperColor: 'var(--paper)',
  textColor: 'var(--ink)',
  invisiblesColor: 'var(--graphite)',
  useSystemColors: true,
};

export const DEFAULT_ELEMENT_STYLES: ElementStylesSettings = {
  sceneHeading: {
    fontWeight: 'normal',
    textDecoration: 'none',
    fontStyle: 'normal',
    uppercase: true,
    align: 'left',
    lineSpacing: 1,
    spaceBefore: 1,
    leftMarginIn: 1.5,
    rightMarginIn: 1.0,
    nextElementType: 'action',
  },
  action: {
    fontWeight: 'normal',
    textDecoration: 'none',
    fontStyle: 'normal',
    uppercase: false,
    align: 'left',
    lineSpacing: 1,
    spaceBefore: 0,
    leftMarginIn: 1.5,
    rightMarginIn: 1.0,
    nextElementType: 'action',
  },
  character: {
    fontWeight: 'bold',
    textDecoration: 'none',
    fontStyle: 'normal',
    uppercase: true,
    align: 'left',
    lineSpacing: 1,
    spaceBefore: 1,
    leftMarginIn: 3.5,
    rightMarginIn: 2.0,
    nextElementType: 'dialogue',
  },
  parenthetical: {
    fontWeight: 'normal',
    textDecoration: 'none',
    fontStyle: 'normal', // Removed default forced italic per Task 3
    uppercase: false,
    align: 'left',
    lineSpacing: 1,
    spaceBefore: 0,
    leftMarginIn: 3.1,
    rightMarginIn: 2.9,
    nextElementType: 'dialogue',
  },
  dialogue: {
    fontWeight: 'normal',
    textDecoration: 'none',
    fontStyle: 'normal',
    uppercase: false,
    align: 'left',
    lineSpacing: 1,
    spaceBefore: 0,
    leftMarginIn: 2.3,
    rightMarginIn: 2.1,
    nextElementType: 'character',
  },
  transition: {
    fontWeight: 'bold',
    textDecoration: 'none',
    fontStyle: 'normal',
    uppercase: true,
    align: 'right',
    lineSpacing: 1,
    spaceBefore: 1,
    leftMarginIn: 1.5,
    rightMarginIn: 1.0,
    nextElementType: 'sceneHeading',
  },
  shot: {
    fontWeight: 'bold',
    textDecoration: 'none',
    fontStyle: 'normal',
    uppercase: true,
    align: 'left',
    lineSpacing: 1,
    spaceBefore: 1,
    leftMarginIn: 1.5,
    rightMarginIn: 1.0,
    nextElementType: 'action',
  },
  textNote: {
    fontWeight: 'normal',
    textDecoration: 'none',
    fontStyle: 'normal',
    uppercase: false,
    align: 'left',
    lineSpacing: 1,
    spaceBefore: 0,
    leftMarginIn: 1.5,
    rightMarginIn: 1.0,
    nextElementType: 'action',
  },
  newAct: {
    fontWeight: 'bold',
    textDecoration: 'none',
    fontStyle: 'normal',
    uppercase: true,
    align: 'center',
    lineSpacing: 1,
    spaceBefore: 2,
    leftMarginIn: 1.5,
    rightMarginIn: 1.0,
    nextElementType: 'action',
  },
  endOfAct: {
    fontWeight: 'bold',
    textDecoration: 'none',
    fontStyle: 'normal',
    uppercase: true,
    align: 'center',
    lineSpacing: 1,
    spaceBefore: 2,
    leftMarginIn: 1.5,
    rightMarginIn: 1.0,
    nextElementType: 'newAct',
  },
  outline: {
    fontWeight: 'normal',
    textDecoration: 'none',
    fontStyle: 'normal',
    uppercase: false,
    align: 'left',
    lineSpacing: 1,
    spaceBefore: 1,
    leftMarginIn: 1.5,
    rightMarginIn: 1.0,
    fontFamily: 'Arial, sans-serif',
    color: '#8b5cf6',
    nextElementType: 'outline',
  },
};

export type SceneNumberPositionOption = 'both' | 'left' | 'right' | 'none';

export interface DocumentFormattingSettings {
  paperFormat: 'US_LETTER' | 'A4';
  fontFamily: FontFamilyOption;
  fontSizePt: number;
  sceneHeadingStyle: SceneHeadingStyle;
  sceneHeadingUppercase: boolean;
  characterNameUppercase: boolean;
  elementStyles: ElementStylesSettings;
  colors?: ColorSettings;
  showSceneNumbers: boolean;
  sceneNumberPosition: SceneNumberPositionOption;
  showPageNumbers: boolean;
  firstPageNumberSuppressed: boolean;
  lineSpacingRatio: number;
  leftMarginIn: number;
  rightMarginIn: number;
  topMarginIn: number;
  bottomMarginIn: number;
  titlePage: TitlePageSettings;
  customCharacters?: string[];
  customSceneHeadings?: string[];
  showMoreAndContd?: boolean;
  dialogueMoreBottomEnabled?: boolean;
  dialogueMoreText?: string;
  dialogueContdTopEnabled?: boolean;
  dialogueContdText?: string;
  automaticCharacterContinueds?: boolean;
  sceneContinuedBottomEnabled?: boolean;
  sceneContinuedBottomText?: string;
  sceneContinuedTopEnabled?: boolean;
  sceneContinuedTopText?: string;
  sceneContinuedNumberEnabled?: boolean;
  headerLeft?: string;
  headerRight?: string;
  footerLeft?: string;
  footerRight?: string;
  headerText?: string;
  footerText?: string;
  showHeaderOnFirstPage?: boolean;
  showFooterOnFirstPage?: boolean;
}

export const DEFAULT_FORMATTING_SETTINGS: DocumentFormattingSettings = {
  paperFormat: 'US_LETTER',
  fontFamily: 'courier_prime',
  fontSizePt: 12,
  sceneHeadingStyle: 'normal',
  sceneHeadingUppercase: true,
  characterNameUppercase: true,
  elementStyles: DEFAULT_ELEMENT_STYLES,
  colors: DEFAULT_COLOR_SETTINGS,
  showSceneNumbers: true,
  sceneNumberPosition: 'both',
  showPageNumbers: true,
  firstPageNumberSuppressed: true,
  lineSpacingRatio: 1.0,
  leftMarginIn: 1.5,
  rightMarginIn: 1.0,
  topMarginIn: 1.0,
  bottomMarginIn: 1.0,
  titlePage: {
    title: '',
    subtitle: 'An Original Screenplay',
    writtenBy: '',
    basedOn: '',
    contactInfo: '',
    draftDate: '',
    revisionTag: 'First Draft',
    copyright: '',
    showTitlePage: true,
  },
  customCharacters: [],
  customSceneHeadings: [],
  showMoreAndContd: true,
  dialogueMoreBottomEnabled: true,
  dialogueMoreText: '(MORE)',
  dialogueContdTopEnabled: true,
  dialogueContdText: "(CONT'D)",
  automaticCharacterContinueds: true,
  sceneContinuedBottomEnabled: false,
  sceneContinuedBottomText: '(CONTINUED)',
  sceneContinuedTopEnabled: false,
  sceneContinuedTopText: 'CONTINUED:',
  sceneContinuedNumberEnabled: true,
  headerLeft: '',
  headerRight: '',
  footerLeft: '',
  footerRight: '',
  headerText: '',
  footerText: '',
  showHeaderOnFirstPage: false,
  showFooterOnFirstPage: false,
};

export interface ScreenplayDocument {
  id: string;
  projectId: string;
  title: string;
  documentType: 'screenplay';
  schemaVersion: 1;
  nodes: ScreenplayNode[];
  scenes: Record<string, SceneMetadata>;
  formattingSettings?: DocumentFormattingSettings;
  version: number; // monotonic revision number
  createdAt: number;
  updatedAt: number;
}

// --- Prose Domain & Document Model ---

export type ProseNodeType =
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'paragraph'
  | 'blockquote'
  | 'bulletItem'
  | 'numberedItem'
  | 'callout'
  | 'divider';

export interface ProseNode {
  id: string;
  type: ProseNodeType;
  text: string;
  attrs?: Record<string, any>;
}

export interface ProseDocument {
  id: string;
  projectId: string;
  title: string;
  documentType: 'prose' | 'richNote' | 'plainNote' | 'reference';
  schemaVersion: 1;
  nodes: ProseNode[];
  version: number;
  createdAt: number;
  updatedAt: number;
}

export type DocumentModel = ScreenplayDocument | ProseDocument;

// --- Editor State & Selection ---

export interface CaretPosition {
  nodeId: string;
  offset: number;
}

export interface SelectionRange {
  anchor: CaretPosition;
  head: CaretPosition;
}

export interface EditorState {
  activeDocumentId: string | null;
  caret: CaretPosition | null;
  selection: SelectionRange | null;
  isFocused: boolean;
}

// --- Editor Commands & Transactions ---

export type EditorCommand =
  | { type: 'insertNode'; targetType: ScreenplayNodeType; afterNodeId?: string; beforeNodeId?: string; initialText?: string; attrs?: Record<string, any> }
  | { type: 'deleteNode'; nodeId: string }
  | { type: 'splitNode'; nodeId: string; offset: number }
  | { type: 'mergeNodes'; targetNodeId: string; sourceNodeId: string }
  | { type: 'convertNodeType'; nodeId: string; targetType: ScreenplayNodeType }
  | { type: 'updateNodeText'; nodeId: string; from: number; to: number; text: string }
  | { type: 'createScene'; afterNodeId?: string; sceneHeadingText?: string; metadata?: Partial<SceneMetadata> }
  | { type: 'deleteScene'; sceneId: string; mode: 'headingOnly' | 'entireScene' }
  | { type: 'screenplayEnter'; nodeId: string; offset: number; selection?: { start: number; end: number } }
  | { type: 'screenplayShiftEnter'; nodeId: string; offset: number; selection?: { start: number; end: number } }
  | { type: 'screenplayTab'; nodeId: string; isShiftTab: boolean }
  | { type: 'changeElementType'; nodeId: string; targetType: ScreenplayNodeType }
  | { type: 'screenplayBackspace'; nodeId: string; offset: number; selection?: { start: number; end: number } }
  | { type: 'screenplayDelete'; nodeId: string; offset: number; selection?: { start: number; end: number } }
  | { type: 'clearAllNodes' }
  | { type: 'replaceAllNodesWithChar'; char: string }
  | { type: 'applyInlineFormat'; format: 'bold' | 'italic' | 'underline' | 'uppercase'; nodeId: string; selection?: { start: number; end: number } }
  | { type: 'screenplayEscape' };

export type Operation =
  | { kind: 'replaceNode'; index: number; oldNode: ScreenplayNode; newNode: ScreenplayNode }
  | { kind: 'insertNode'; index: number; node: ScreenplayNode }
  | { kind: 'removeNode'; index: number; node: ScreenplayNode }
  | { kind: 'updateSceneMeta'; sceneId: string; oldMeta?: SceneMetadata; newMeta?: SceneMetadata };

export interface SemanticTransaction {
  id: string;
  docId: string;
  timestamp: number;
  commandType: string;
  operations: Operation[];
  invertedOperations: Operation[];
  beforeCaret: CaretPosition | null;
  afterCaret: CaretPosition | null;
}

// --- Persistence Journal Entry ---

export interface JournalEntry {
  id: string;
  docId: string;
  version: number;
  timestamp: number;
  transaction: SemanticTransaction;
}
