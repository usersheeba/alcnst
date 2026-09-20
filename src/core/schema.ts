/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ScreenplayNodeType,
  ScreenplayNode,
  ScreenplayDocument,
  ProseNodeType,
  ProseNode,
  ProseDocument,
} from '../types';

// Supported screenplay node types
export const SCREENPLAY_NODE_TYPES: readonly ScreenplayNodeType[] = [
  'sceneHeading',
  'action',
  'character',
  'parenthetical',
  'dialogue',
  'transition',
  'shot',
  'textNote',
  'newAct',
  'endOfAct',
  'outline',
] as const;

export function isValidScreenplayNodeType(type: string): type is ScreenplayNodeType {
  return (SCREENPLAY_NODE_TYPES as readonly string[]).includes(type);
}

// Supported prose node types
export const PROSE_NODE_TYPES: readonly ProseNodeType[] = [
  'heading1',
  'heading2',
  'heading3',
  'paragraph',
  'blockquote',
  'bulletItem',
  'numberedItem',
  'callout',
  'divider',
] as const;

export function isValidProseNodeType(type: string): type is ProseNodeType {
  return (PROSE_NODE_TYPES as readonly string[]).includes(type);
}

/**
 * Text normalization rules per element type.
 * - character and sceneHeading are normalized to uppercase.
 * - parenthetical is enclosed in parentheses.
 */
export function normalizeScreenplayNode(node: ScreenplayNode): ScreenplayNode {
  let text = node.text;

  if (node.type === 'character' || node.type === 'sceneHeading') {
    text = text.toUpperCase();
  } else if (node.type === 'parenthetical') {
    let inner = text.trim();
    if (inner.startsWith('(')) inner = inner.slice(1);
    if (inner.endsWith(')')) inner = inner.slice(0, -1);
    text = inner;
  }

  return {
    ...node,
    text,
  };
}

/**
 * Grammar state machine for Enter key.
 * Determines the resulting node type when pressing Enter at the end of a block.
 */
export function getNextNodeTypeOnEnter(
  currentType: ScreenplayNodeType,
  hasText: boolean
): { nextType: ScreenplayNodeType; transformCurrent?: ScreenplayNodeType } {
  // Empty block transitions
  if (!hasText) {
    if (currentType === 'dialogue') {
      // Section 3.5 & 4: Explicit empty-dialogue exit rule / Double-Enter shortcut
      return { nextType: 'action', transformCurrent: 'action' };
    }
    if (currentType === 'character') {
      // Section 3.3: Empty character deterministically converts to dialogue; NEVER becomes action
      return { nextType: 'dialogue', transformCurrent: 'dialogue' };
    }
    if (currentType === 'parenthetical') {
      // Section 3.4: Empty parenthetical converts to dialogue
      return { nextType: 'dialogue', transformCurrent: 'dialogue' };
    }
    if (currentType === 'transition') {
      return { nextType: 'sceneHeading', transformCurrent: 'sceneHeading' };
    }
    return { nextType: 'action' };
  }

  // Non-empty block transitions
  switch (currentType) {
    case 'sceneHeading':
      // Section 3.1: Scene Heading -> Action
      return { nextType: 'action' };
    case 'action':
      // Section 3.2: Action -> Action
      return { nextType: 'action' };
    case 'character':
      // Section 3.3: Character -> Dialogue (mandatory, never action)
      return { nextType: 'dialogue' };
    case 'parenthetical':
      // Section 3.4: Parenthetical -> Dialogue
      return { nextType: 'dialogue' };
    case 'dialogue':
      // Section 3.5: Dialogue continuation -> Character
      return { nextType: 'character' };
    case 'transition':
      // Section 5: Transition -> Scene Heading
      return { nextType: 'sceneHeading' };
    case 'shot':
      // Section 6: Shot -> Action
      return { nextType: 'action' };
    case 'textNote':
      // Section 7: Text Note -> Action
      return { nextType: 'action' };
    case 'newAct':
      return { nextType: 'action' };
    case 'endOfAct':
      return { nextType: 'newAct' };
    case 'outline':
      return { nextType: 'outline' };
    default:
      return { nextType: 'action' };
  }
}

/**
 * Grammar state machine for Tab key.
 * Section 9 Required forward cycle:
 * ACTION -> CHARACTER -> PARENTHETICAL -> DIALOGUE -> PARENTHETICAL
 */
export function getNextNodeTypeOnTab(
  currentType: ScreenplayNodeType
): ScreenplayNodeType {
  switch (currentType) {
    case 'action':
      return 'character';
    case 'character':
      return 'dialogue';
    case 'dialogue':
      return 'parenthetical';
    case 'parenthetical':
      return 'transition';
    case 'transition':
      return 'action';
    case 'sceneHeading':
      return 'action';
    case 'shot':
      return 'action';
    case 'textNote':
      return 'action';
    case 'newAct':
      return 'action';
    case 'endOfAct':
      return 'action';
    case 'outline':
      return 'action';
    default:
      return 'action';
  }
}

/**
 * Grammar state machine for Shift+Tab key.
 * Section 10 Required backward transitions:
 * Action -> Transition -> Parenthetical -> Dialogue -> Character -> Action
 */
export function getPreviousNodeTypeOnTab(
  currentType: ScreenplayNodeType
): ScreenplayNodeType {
  switch (currentType) {
    case 'action':
      return 'transition';
    case 'transition':
      return 'parenthetical';
    case 'parenthetical':
      return 'dialogue';
    case 'dialogue':
      return 'character';
    case 'character':
      return 'action';
    case 'sceneHeading':
      return 'transition';
    case 'shot':
      return 'action';
    case 'textNote':
      return 'action';
    case 'newAct':
      return 'action';
    case 'endOfAct':
      return 'action';
    case 'outline':
      return 'action';
    default:
      return 'action';
  }
}

/**
 * Screenplay Document Schema Validator
 * Enforces that:
 * 1. All nodes are valid ScreenplayNodeType
 * 2. Every node has a non-empty string ID
 * 3. No prose nodes exist in the document
 */
export function validateScreenplayDocument(doc: ScreenplayDocument): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (doc.documentType !== 'screenplay') {
    errors.push(`Invalid documentType: expected 'screenplay', got '${doc.documentType}'`);
  }

  if (!Array.isArray(doc.nodes)) {
    errors.push('Document nodes must be an array');
    return { valid: false, errors };
  }

  const seenIds = new Set<string>();

  doc.nodes.forEach((node, index) => {
    if (!node.id || typeof node.id !== 'string') {
      errors.push(`Node at index ${index} missing valid 'id'`);
    } else if (seenIds.has(node.id)) {
      errors.push(`Duplicate node id: ${node.id} at index ${index}`);
    } else {
      seenIds.add(node.id);
    }

    if (!isValidScreenplayNodeType(node.type)) {
      errors.push(
        `Node ${node.id || index} has invalid ScreenplayNodeType: '${node.type}'`
      );
    }

    if (typeof node.text !== 'string') {
      errors.push(`Node ${node.id || index} has non-string text`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Prose Document Schema Validator
 */
export function validateProseDocument(doc: ProseDocument): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if ((doc as any).documentType === 'screenplay') {
    errors.push("Prose document cannot have documentType 'screenplay'");
  }

  if (!Array.isArray(doc.nodes)) {
    errors.push('Document nodes must be an array');
    return { valid: false, errors };
  }

  doc.nodes.forEach((node, index) => {
    if (!isValidProseNodeType(node.type)) {
      errors.push(
        `Node ${node.id || index} has invalid ProseNodeType: '${node.type}'`
      );
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
