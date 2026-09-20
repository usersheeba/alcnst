/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EditorCommand,
  ScreenplayDocument,
  ScreenplayNode,
  CaretPosition,
  SemanticTransaction,
  Operation,
  SceneMetadata,
} from '../types';
import {
  normalizeScreenplayNode,
  isValidScreenplayNodeType,
  getNextNodeTypeOnTab,
  getPreviousNodeTypeOnTab,
} from './schema';

export function generateId(prefix: string = 'n'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface CommandExecutionResult {
  newDoc: ScreenplayDocument;
  newCaret: CaretPosition | null;
  transaction: SemanticTransaction;
}

export type CommandResult =
  | CommandExecutionResult
  | { error: string };

/**
 * Executes an EditorCommand through the validation and transaction layer.
 * Returns the new immutable document, new caret position, and the reversible transaction.
 */
export function executeCommand(
  doc: ScreenplayDocument,
  command: EditorCommand,
  currentCaret: CaretPosition | null
): CommandResult {
  const operations: Operation[] = [];
  const invertedOperations: Operation[] = [];
  let newNodes = [...doc.nodes];
  let newScenes = { ...doc.scenes };
  let newCaret: CaretPosition | null = currentCaret;

  const docId = doc.id;

  switch (command.type) {
    case 'insertNode': {
      if (!isValidScreenplayNodeType(command.targetType)) {
        return { error: `Invalid screenplay node type: ${command.targetType}` };
      }

      let targetIndex = newNodes.length;
      let activeSceneId: string | undefined = undefined;

      if (command.beforeNodeId) {
        const idx = newNodes.findIndex((n) => n.id === command.beforeNodeId);
        if (idx !== -1) {
          targetIndex = idx;
          activeSceneId = newNodes[idx].sceneId;
        }
      } else if (command.afterNodeId) {
        const idx = newNodes.findIndex((n) => n.id === command.afterNodeId);
        if (idx !== -1) {
          targetIndex = idx + 1;
          activeSceneId = newNodes[idx].sceneId;
        }
      } else if (currentCaret) {
        const idx = newNodes.findIndex((n) => n.id === currentCaret.nodeId);
        if (idx !== -1) {
          targetIndex = idx + 1;
          activeSceneId = newNodes[idx].sceneId;
        }
      }

      const newNode: ScreenplayNode = normalizeScreenplayNode({
        id: generateId('node'),
        type: command.targetType,
        text: command.initialText || '',
        sceneId: activeSceneId,
        attrs: command.attrs || {},
      });

      newNodes.splice(targetIndex, 0, newNode);

      operations.push({ kind: 'insertNode', index: targetIndex, node: newNode });
      invertedOperations.push({ kind: 'removeNode', index: targetIndex, node: newNode });

      newCaret = {
        nodeId: newNode.id,
        offset: newNode.text.length,
      };
      break;
    }

    case 'deleteNode': {
      const idx = newNodes.findIndex((n) => n.id === command.nodeId);
      if (idx === -1) {
        return { error: `Node ${command.nodeId} not found` };
      }

      // Never delete if it's the only node; instead convert to action and clear text
      if (newNodes.length === 1) {
        const oldNode = newNodes[0];
        const emptyNode: ScreenplayNode = {
          ...oldNode,
          type: 'action',
          text: '',
        };
        newNodes[0] = emptyNode;
        operations.push({ kind: 'replaceNode', index: 0, oldNode, newNode: emptyNode });
        invertedOperations.push({ kind: 'replaceNode', index: 0, oldNode: emptyNode, newNode: oldNode });
        newCaret = { nodeId: emptyNode.id, offset: 0 };
        break;
      }

      const oldNode = newNodes[idx];
      newNodes.splice(idx, 1);

      operations.push({ kind: 'removeNode', index: idx, node: oldNode });
      invertedOperations.push({ kind: 'insertNode', index: idx, node: oldNode });

      const prevIdx = Math.max(0, idx - 1);
      newCaret = {
        nodeId: newNodes[prevIdx].id,
        offset: newNodes[prevIdx].text.length,
      };
      break;
    }

    case 'splitNode': {
      const idx = newNodes.findIndex((n) => n.id === command.nodeId);
      if (idx === -1) {
        return { error: `Node ${command.nodeId} not found` };
      }

      const originalNode = newNodes[idx];
      const offset = Math.max(0, Math.min(command.offset, originalNode.text.length));
      const leftText = originalNode.text.slice(0, offset);
      const rightText = originalNode.text.slice(offset);

      const leftNode: ScreenplayNode = normalizeScreenplayNode({
        ...originalNode,
        text: leftText,
      });

      // When splitting a sceneHeading, the split remainder becomes action
      const rightType = originalNode.type === 'sceneHeading' ? 'action' : originalNode.type;
      const rightNode: ScreenplayNode = normalizeScreenplayNode({
        id: generateId('node'),
        type: rightType,
        text: rightText,
        sceneId: originalNode.sceneId,
        attrs: { ...originalNode.attrs },
      });

      newNodes[idx] = leftNode;
      newNodes.splice(idx + 1, 0, rightNode);

      operations.push({ kind: 'replaceNode', index: idx, oldNode: originalNode, newNode: leftNode });
      operations.push({ kind: 'insertNode', index: idx + 1, node: rightNode });

      invertedOperations.push({ kind: 'removeNode', index: idx + 1, node: rightNode });
      invertedOperations.push({ kind: 'replaceNode', index: idx, oldNode: leftNode, newNode: originalNode });

      newCaret = { nodeId: rightNode.id, offset: 0 };
      break;
    }

    case 'mergeNodes': {
      const targetIdx = newNodes.findIndex((n) => n.id === command.targetNodeId);
      const sourceIdx = newNodes.findIndex((n) => n.id === command.sourceNodeId);

      if (targetIdx === -1 || sourceIdx === -1) {
        return { error: 'Target or source node not found for merge' };
      }

      const targetNode = newNodes[targetIdx];
      const sourceNode = newNodes[sourceIdx];

      const previousTargetTextLength = targetNode.text.length;
      const mergedNode: ScreenplayNode = normalizeScreenplayNode({
        ...targetNode,
        text: targetNode.text + sourceNode.text,
      });

      newNodes[targetIdx] = mergedNode;
      newNodes.splice(sourceIdx, 1);

      operations.push({ kind: 'replaceNode', index: targetIdx, oldNode: targetNode, newNode: mergedNode });
      operations.push({ kind: 'removeNode', index: sourceIdx, node: sourceNode });

      invertedOperations.push({ kind: 'insertNode', index: sourceIdx, node: sourceNode });
      invertedOperations.push({ kind: 'replaceNode', index: targetIdx, oldNode: mergedNode, newNode: targetNode });

      newCaret = { nodeId: mergedNode.id, offset: previousTargetTextLength };
      break;
    }

    case 'convertNodeType': {
      if (!isValidScreenplayNodeType(command.targetType)) {
        return { error: `Invalid target node type: ${command.targetType}` };
      }

      const idx = newNodes.findIndex((n) => n.id === command.nodeId);
      if (idx === -1) {
        return { error: `Node ${command.nodeId} not found` };
      }

      const oldNode = newNodes[idx];
      if (oldNode.type === command.targetType) {
        // No-op if same type
        return {
          newDoc: doc,
          newCaret: currentCaret,
          transaction: {
            id: generateId('tx'),
            docId,
            timestamp: Date.now(),
            commandType: 'convertNodeType',
            operations: [],
            invertedOperations: [],
            beforeCaret: currentCaret,
            afterCaret: currentCaret,
          },
        };
      }

      let updatedText = oldNode.text;
      // Strip outer parentheses if converting away from parenthetical
      if (oldNode.type === 'parenthetical' && command.targetType !== 'parenthetical') {
        let trimmed = updatedText.trim();
        if (trimmed.startsWith('(')) trimmed = trimmed.slice(1);
        if (trimmed.endsWith(')')) trimmed = trimmed.slice(0, -1);
        updatedText = trimmed;
      }

      const newNode = normalizeScreenplayNode({
        ...oldNode,
        type: command.targetType,
        text: updatedText,
      });

      newNodes[idx] = newNode;

      operations.push({ kind: 'replaceNode', index: idx, oldNode, newNode });
      invertedOperations.push({ kind: 'replaceNode', index: idx, oldNode: newNode, newNode: oldNode });

      newCaret = {
        nodeId: newNode.id,
        offset: Math.min(currentCaret?.offset || 0, newNode.text.length),
      };
      break;
    }

    case 'updateNodeText': {
      const idx = newNodes.findIndex((n) => n.id === command.nodeId);
      if (idx === -1) {
        return { error: `Node ${command.nodeId} not found` };
      }

      const oldNode = newNodes[idx];
      const from = Math.max(0, Math.min(command.from, oldNode.text.length));
      const to = Math.max(from, Math.min(command.to, oldNode.text.length));

      const updatedText = oldNode.text.slice(0, from) + command.text + oldNode.text.slice(to);

      const newNode = normalizeScreenplayNode({
        ...oldNode,
        text: updatedText,
      });

      newNodes[idx] = newNode;

      operations.push({ kind: 'replaceNode', index: idx, oldNode, newNode });
      invertedOperations.push({ kind: 'replaceNode', index: idx, oldNode: newNode, newNode: oldNode });

      newCaret = { nodeId: newNode.id, offset: from + command.text.length };
      break;
    }

    case 'createScene': {
      const sceneId = generateId('sc');
      const headingNodeId = generateId('node');
      const headingText = (command.sceneHeadingText || 'INT. NEW SCENE - DAY').toUpperCase();

      let targetIndex = newNodes.length;
      if (command.afterNodeId) {
        const idx = newNodes.findIndex((n) => n.id === command.afterNodeId);
        if (idx !== -1) targetIndex = idx + 1;
      } else if (currentCaret) {
        const idx = newNodes.findIndex((n) => n.id === currentCaret.nodeId);
        if (idx !== -1) targetIndex = idx + 1;
      }

      // Calculate next scene number
      const existingSceneCount = Object.keys(newScenes).length;
      const sceneNumber = (existingSceneCount + 1).toString();

      const headingNode: ScreenplayNode = {
        id: headingNodeId,
        type: 'sceneHeading',
        text: headingText,
        sceneId,
        attrs: {
          sceneNumber,
        },
      };

      const sceneMeta: SceneMetadata = {
        id: sceneId,
        headingNodeId,
        sceneNumber,
        location: headingText.split('-')[0]?.replace(/^(INT\.|EXT\.|INT\/EXT\.)\s*/i, '').trim() || 'LOCATION',
        timeOfDay: headingText.split('-')[1]?.trim() || 'DAY',
        synopsis: command.metadata?.synopsis || '',
        notes: command.metadata?.notes || [],
        status: command.metadata?.status || 'Draft',
        characters: [],
        updatedAt: Date.now(),
      };

      newNodes.splice(targetIndex, 0, headingNode);
      newScenes[sceneId] = sceneMeta;

      operations.push({ kind: 'insertNode', index: targetIndex, node: headingNode });
      operations.push({ kind: 'updateSceneMeta', sceneId, newMeta: sceneMeta });

      invertedOperations.push({ kind: 'removeNode', index: targetIndex, node: headingNode });
      invertedOperations.push({ kind: 'updateSceneMeta', sceneId, oldMeta: sceneMeta });

      newCaret = { nodeId: headingNode.id, offset: headingNode.text.length };
      break;
    }

    case 'deleteScene': {
      const scene = newScenes[command.sceneId];
      if (!scene) {
        return { error: `Scene ${command.sceneId} not found` };
      }

      if (command.mode === 'headingOnly') {
        const idx = newNodes.findIndex((n) => n.id === scene.headingNodeId);
        if (idx !== -1) {
          const oldNode = newNodes[idx];
          const convertedNode: ScreenplayNode = {
            ...oldNode,
            type: 'action',
          };
          newNodes[idx] = convertedNode;
          delete newScenes[command.sceneId];

          operations.push({ kind: 'replaceNode', index: idx, oldNode, newNode: convertedNode });
          operations.push({ kind: 'updateSceneMeta', sceneId: command.sceneId, oldMeta: scene });

          invertedOperations.push({ kind: 'updateSceneMeta', sceneId: command.sceneId, newMeta: scene });
          invertedOperations.push({ kind: 'replaceNode', index: idx, oldNode: convertedNode, newNode: oldNode });
        }
      } else {
        // delete entire scene nodes
        const nodesToRemove: { index: number; node: ScreenplayNode }[] = [];
        for (let i = newNodes.length - 1; i >= 0; i--) {
          if (newNodes[i].sceneId === command.sceneId || newNodes[i].id === scene.headingNodeId) {
            nodesToRemove.push({ index: i, node: newNodes[i] });
            newNodes.splice(i, 1);
          }
        }
        delete newScenes[command.sceneId];

        nodesToRemove.forEach(({ index, node }) => {
          operations.push({ kind: 'removeNode', index, node });
          invertedOperations.push({ kind: 'insertNode', index, node });
        });
        operations.push({ kind: 'updateSceneMeta', sceneId: command.sceneId, oldMeta: scene });
        invertedOperations.push({ kind: 'updateSceneMeta', sceneId: command.sceneId, newMeta: scene });
      }

      // Ensure document has at least one node
      if (newNodes.length === 0) {
        const fallbackNode: ScreenplayNode = {
          id: generateId('node'),
          type: 'action',
          text: '',
        };
        newNodes.push(fallbackNode);
      }

      newCaret = { nodeId: newNodes[0].id, offset: 0 };
      break;
    }

    case 'changeElementType': {
      if (!isValidScreenplayNodeType(command.targetType)) {
        return { error: `Invalid target node type: ${command.targetType}` };
      }

      const idx = newNodes.findIndex((n) => n.id === command.nodeId);
      if (idx === -1) {
        return { error: `Node ${command.nodeId} not found` };
      }

      const oldNode = newNodes[idx];
      if (oldNode.type === command.targetType) {
        // No-op
        return {
          newDoc: doc,
          newCaret: currentCaret,
          transaction: {
            id: generateId('tx'),
            docId,
            timestamp: Date.now(),
            commandType: 'changeElementType',
            operations: [],
            invertedOperations: [],
            beforeCaret: currentCaret,
            afterCaret: currentCaret,
          },
        };
      }

      let updatedText = oldNode.text;
      if (oldNode.type === 'parenthetical' && command.targetType !== 'parenthetical') {
        let trimmed = updatedText.trim();
        if (trimmed.startsWith('(')) trimmed = trimmed.slice(1);
        if (trimmed.endsWith(')')) trimmed = trimmed.slice(0, -1);
        updatedText = trimmed;
      }

      const newNode = normalizeScreenplayNode({
        ...oldNode,
        type: command.targetType,
        text: updatedText,
      });

      newNodes[idx] = newNode;
      operations.push({ kind: 'replaceNode', index: idx, oldNode, newNode });
      invertedOperations.push({ kind: 'replaceNode', index: idx, oldNode: newNode, newNode: oldNode });

      newCaret = {
        nodeId: newNode.id,
        offset: Math.min(currentCaret?.offset || 0, newNode.text.length),
      };
      break;
    }

    case 'screenplayEnter': {
      const idx = newNodes.findIndex((n) => n.id === command.nodeId);
      if (idx === -1) {
        return { error: `Node ${command.nodeId} not found` };
      }

      const node = newNodes[idx];
      let offset = command.offset;
      let text = node.text;

      // 1. Selection behavior: replace selected text with Enter splitting / transition behavior (Section 15)
      if (command.selection && command.selection.start !== command.selection.end) {
        const start = Math.min(command.selection.start, command.selection.end);
        const end = Math.max(command.selection.start, command.selection.end);
        text = text.slice(0, start) + text.slice(end);
        offset = start;
      }

      const textLength = text.length;
      const isEmpty = node.type === 'parenthetical'
        ? text.replace(/[()]/g, '').trim().length === 0
        : text.trim().length === 0;
      const isAtStart = offset === 0;
      const isAtEnd = offset >= textLength;

      if (node.type === 'character') {
        // Section 3.3:
        // CHARACTER -> Enter -> DIALOGUE (Mandatory. It must NEVER become Action.)
        if (isEmpty) {
          // Deterministic empty character rule: replace empty Character with Dialogue
          const convertedNode: ScreenplayNode = normalizeScreenplayNode({
            ...node,
            type: 'dialogue',
            text: '',
          });
          newNodes[idx] = convertedNode;
          operations.push({ kind: 'replaceNode', index: idx, oldNode: node, newNode: convertedNode });
          invertedOperations.push({ kind: 'replaceNode', index: idx, oldNode: convertedNode, newNode: node });
          newCaret = { nodeId: convertedNode.id, offset: 0 };
        } else if (isAtStart) {
          const newNode: ScreenplayNode = normalizeScreenplayNode({
            id: generateId('node'),
            type: 'action',
            text: '',
            sceneId: node.sceneId,
          });
          newNodes.splice(idx, 0, newNode);
          operations.push({ kind: 'insertNode', index: idx, node: newNode });
          invertedOperations.push({ kind: 'removeNode', index: idx, node: newNode });
          newCaret = { nodeId: newNode.id, offset: 0 };
        } else if (isAtEnd) {
          const updatedNode: ScreenplayNode = normalizeScreenplayNode({
            ...node,
            text,
          });
          newNodes[idx] = updatedNode;
          if (updatedNode.text !== node.text) {
            operations.push({ kind: 'replaceNode', index: idx, oldNode: node, newNode: updatedNode });
            invertedOperations.push({ kind: 'replaceNode', index: idx, oldNode: updatedNode, newNode: node });
          }

          const newDialogueNode: ScreenplayNode = normalizeScreenplayNode({
            id: generateId('node'),
            type: 'dialogue',
            text: '',
            sceneId: node.sceneId,
          });
          newNodes.splice(idx + 1, 0, newDialogueNode);
          operations.push({ kind: 'insertNode', index: idx + 1, node: newDialogueNode });
          invertedOperations.push({ kind: 'removeNode', index: idx + 1, node: newDialogueNode });
          newCaret = { nodeId: newDialogueNode.id, offset: 0 };
        } else {
          // Mid-split
          const leftNode: ScreenplayNode = normalizeScreenplayNode({
            ...node,
            text: text.slice(0, offset),
          });
          const rightNode: ScreenplayNode = normalizeScreenplayNode({
            id: generateId('node'),
            type: 'character',
            text: text.slice(offset),
            sceneId: node.sceneId,
          });
          newNodes[idx] = leftNode;
          newNodes.splice(idx + 1, 0, rightNode);
          operations.push({ kind: 'replaceNode', index: idx, oldNode: node, newNode: leftNode });
          operations.push({ kind: 'insertNode', index: idx + 1, node: rightNode });
          invertedOperations.push({ kind: 'removeNode', index: idx + 1, node: rightNode });
          invertedOperations.push({ kind: 'replaceNode', index: idx, oldNode: leftNode, newNode: node });
          newCaret = { nodeId: rightNode.id, offset: 0 };
        }
      } else if (node.type === 'dialogue') {
        // Section 3.5 & 4:
        // At end of non-empty dialogue -> CHARACTER
        // Empty dialogue -> ACTION (exit rule / double enter)
        // Mid-split -> both remain DIALOGUE
        if (isEmpty) {
          const convertedNode: ScreenplayNode = normalizeScreenplayNode({
            ...node,
            type: 'action',
            text: '',
          });
          newNodes[idx] = convertedNode;
          operations.push({ kind: 'replaceNode', index: idx, oldNode: node, newNode: convertedNode });
          invertedOperations.push({ kind: 'replaceNode', index: idx, oldNode: convertedNode, newNode: node });
          newCaret = { nodeId: convertedNode.id, offset: 0 };
        } else if (isAtStart) {
          const newNode: ScreenplayNode = normalizeScreenplayNode({
            id: generateId('node'),
            type: 'dialogue',
            text: '',
            sceneId: node.sceneId,
          });
          newNodes.splice(idx, 0, newNode);
          operations.push({ kind: 'insertNode', index: idx, node: newNode });
          invertedOperations.push({ kind: 'removeNode', index: idx, node: newNode });
          newCaret = { nodeId: newNode.id, offset: 0 };
        } else if (isAtEnd) {
          const updatedNode: ScreenplayNode = normalizeScreenplayNode({
            ...node,
            text,
          });
          newNodes[idx] = updatedNode;
          if (updatedNode.text !== node.text) {
            operations.push({ kind: 'replaceNode', index: idx, oldNode: node, newNode: updatedNode });
            invertedOperations.push({ kind: 'replaceNode', index: idx, oldNode: updatedNode, newNode: node });
          }

          const newCharNode: ScreenplayNode = normalizeScreenplayNode({
            id: generateId('node'),
            type: 'character',
            text: '',
            sceneId: node.sceneId,
          });
          newNodes.splice(idx + 1, 0, newCharNode);
          operations.push({ kind: 'insertNode', index: idx + 1, node: newCharNode });
          invertedOperations.push({ kind: 'removeNode', index: idx + 1, node: newCharNode });
          newCaret = { nodeId: newCharNode.id, offset: 0 };
        } else {
          // Mid-split in dialogue: BOTH resulting nodes remain Dialogue
          const leftNode: ScreenplayNode = normalizeScreenplayNode({
            ...node,
            text: text.slice(0, offset),
          });
          const rightNode: ScreenplayNode = normalizeScreenplayNode({
            id: generateId('node'),
            type: 'dialogue',
            text: text.slice(offset),
            sceneId: node.sceneId,
          });
          newNodes[idx] = leftNode;
          newNodes.splice(idx + 1, 0, rightNode);
          operations.push({ kind: 'replaceNode', index: idx, oldNode: node, newNode: leftNode });
          operations.push({ kind: 'insertNode', index: idx + 1, node: rightNode });
          invertedOperations.push({ kind: 'removeNode', index: idx + 1, node: rightNode });
          invertedOperations.push({ kind: 'replaceNode', index: idx, oldNode: leftNode, newNode: node });
          newCaret = { nodeId: rightNode.id, offset: 0 };
        }
      } else if (node.type === 'parenthetical') {
        // Section 3.4: PARENTHETICAL -> Enter -> DIALOGUE
        if (isEmpty) {
          const convertedNode: ScreenplayNode = normalizeScreenplayNode({
            ...node,
            type: 'dialogue',
            text: '',
          });
          newNodes[idx] = convertedNode;
          operations.push({ kind: 'replaceNode', index: idx, oldNode: node, newNode: convertedNode });
          invertedOperations.push({ kind: 'replaceNode', index: idx, oldNode: convertedNode, newNode: node });
          newCaret = { nodeId: convertedNode.id, offset: 0 };
        } else {
          // Parse parenthetical parts
          let innerText = text.trim();
          if (innerText.startsWith('(')) innerText = innerText.slice(1);
          if (innerText.endsWith(')')) innerText = innerText.slice(0, -1);

          // Find offset inside parenthetical text
          const innerOffset = Math.max(0, Math.min(offset, innerText.length));

          const leftInner = innerText.slice(0, innerOffset).trim();
          const rightInner = innerText.slice(innerOffset).trim();

          // Left side remains the parenthetical
          const leftNode: ScreenplayNode = normalizeScreenplayNode({
            ...node,
            text: leftInner,
          });

          // Right side transitions to standard Dialogue
          const rightNode: ScreenplayNode = normalizeScreenplayNode({
            id: generateId('node'),
            type: 'dialogue',
            text: rightInner,
            sceneId: node.sceneId,
          });

          newNodes[idx] = leftNode;
          newNodes.splice(idx + 1, 0, rightNode);

          operations.push({ kind: 'replaceNode', index: idx, oldNode: node, newNode: leftNode });
          operations.push({ kind: 'insertNode', index: idx + 1, node: rightNode });

          invertedOperations.push({ kind: 'removeNode', index: idx + 1, node: rightNode });
          invertedOperations.push({ kind: 'replaceNode', index: idx, oldNode: leftNode, newNode: node });

          newCaret = { nodeId: rightNode.id, offset: 0 };
        }
      } else if (node.type === 'sceneHeading') {
        // Section 3.1: SCENE HEADING -> Enter -> ACTION
        if (isAtStart && !isEmpty) {
          const newNode: ScreenplayNode = normalizeScreenplayNode({
            id: generateId('node'),
            type: 'sceneHeading',
            text: '',
            sceneId: node.sceneId,
          });
          newNodes.splice(idx, 0, newNode);
          operations.push({ kind: 'insertNode', index: idx, node: newNode });
          invertedOperations.push({ kind: 'removeNode', index: idx, node: newNode });
          newCaret = { nodeId: newNode.id, offset: 0 };
        } else if (isAtEnd || isEmpty) {
          const updatedNode: ScreenplayNode = normalizeScreenplayNode({
            ...node,
            text,
          });
          newNodes[idx] = updatedNode;
          if (updatedNode.text !== node.text) {
            operations.push({ kind: 'replaceNode', index: idx, oldNode: node, newNode: updatedNode });
            invertedOperations.push({ kind: 'replaceNode', index: idx, oldNode: updatedNode, newNode: node });
          }

          const newActionNode: ScreenplayNode = normalizeScreenplayNode({
            id: generateId('node'),
            type: 'action',
            text: '',
            sceneId: node.sceneId,
          });
          newNodes.splice(idx + 1, 0, newActionNode);
          operations.push({ kind: 'insertNode', index: idx + 1, node: newActionNode });
          invertedOperations.push({ kind: 'removeNode', index: idx + 1, node: newActionNode });
          newCaret = { nodeId: newActionNode.id, offset: 0 };
        } else {
          const leftNode: ScreenplayNode = normalizeScreenplayNode({
            ...node,
            text: text.slice(0, offset),
          });
          const rightNode: ScreenplayNode = normalizeScreenplayNode({
            id: generateId('node'),
            type: 'action',
            text: text.slice(offset),
            sceneId: node.sceneId,
          });
          newNodes[idx] = leftNode;
          newNodes.splice(idx + 1, 0, rightNode);
          operations.push({ kind: 'replaceNode', index: idx, oldNode: node, newNode: leftNode });
          operations.push({ kind: 'insertNode', index: idx + 1, node: rightNode });
          invertedOperations.push({ kind: 'removeNode', index: idx + 1, node: rightNode });
          invertedOperations.push({ kind: 'replaceNode', index: idx, oldNode: leftNode, newNode: node });
          newCaret = { nodeId: rightNode.id, offset: 0 };
        }
      } else if (node.type === 'transition') {
        // Section 5: Transition -> Scene Heading
        if (isAtEnd || isEmpty) {
          const newHeadingNode: ScreenplayNode = normalizeScreenplayNode({
            id: generateId('node'),
            type: 'sceneHeading',
            text: '',
          });
          newNodes.splice(idx + 1, 0, newHeadingNode);
          operations.push({ kind: 'insertNode', index: idx + 1, node: newHeadingNode });
          invertedOperations.push({ kind: 'removeNode', index: idx + 1, node: newHeadingNode });
          newCaret = { nodeId: newHeadingNode.id, offset: 0 };
        } else {
          const leftNode: ScreenplayNode = normalizeScreenplayNode({
            ...node,
            text: text.slice(0, offset),
          });
          const rightNode: ScreenplayNode = normalizeScreenplayNode({
            id: generateId('node'),
            type: 'sceneHeading',
            text: text.slice(offset),
          });
          newNodes[idx] = leftNode;
          newNodes.splice(idx + 1, 0, rightNode);
          operations.push({ kind: 'replaceNode', index: idx, oldNode: node, newNode: leftNode });
          operations.push({ kind: 'insertNode', index: idx + 1, node: rightNode });
          invertedOperations.push({ kind: 'removeNode', index: idx + 1, node: rightNode });
          invertedOperations.push({ kind: 'replaceNode', index: idx, oldNode: leftNode, newNode: node });
          newCaret = { nodeId: rightNode.id, offset: 0 };
        }
      } else {
        // action, shot, textNote -> creates new action block
        // Section 3.2: ACTION -> Enter -> ACTION
        if (isAtStart && !isEmpty) {
          const newNode: ScreenplayNode = normalizeScreenplayNode({
            id: generateId('node'),
            type: 'action',
            text: '',
            sceneId: node.sceneId,
          });
          newNodes.splice(idx, 0, newNode);
          operations.push({ kind: 'insertNode', index: idx, node: newNode });
          invertedOperations.push({ kind: 'removeNode', index: idx, node: newNode });
          newCaret = { nodeId: newNode.id, offset: 0 };
        } else if (isAtEnd || isEmpty) {
          const updatedNode: ScreenplayNode = normalizeScreenplayNode({
            ...node,
            text,
          });
          newNodes[idx] = updatedNode;
          if (updatedNode.text !== node.text) {
            operations.push({ kind: 'replaceNode', index: idx, oldNode: node, newNode: updatedNode });
            invertedOperations.push({ kind: 'replaceNode', index: idx, oldNode: updatedNode, newNode: node });
          }

          const newActionNode: ScreenplayNode = normalizeScreenplayNode({
            id: generateId('node'),
            type: 'action',
            text: '',
            sceneId: node.sceneId,
          });
          newNodes.splice(idx + 1, 0, newActionNode);
          operations.push({ kind: 'insertNode', index: idx + 1, node: newActionNode });
          invertedOperations.push({ kind: 'removeNode', index: idx + 1, node: newActionNode });
          newCaret = { nodeId: newActionNode.id, offset: 0 };
        } else {
          // Mid-split in action: both remain Action
          const leftNode: ScreenplayNode = normalizeScreenplayNode({
            ...node,
            text: text.slice(0, offset),
          });
          const rightNode: ScreenplayNode = normalizeScreenplayNode({
            id: generateId('node'),
            type: 'action',
            text: text.slice(offset),
            sceneId: node.sceneId,
          });
          newNodes[idx] = leftNode;
          newNodes.splice(idx + 1, 0, rightNode);
          operations.push({ kind: 'replaceNode', index: idx, oldNode: node, newNode: leftNode });
          operations.push({ kind: 'insertNode', index: idx + 1, node: rightNode });
          invertedOperations.push({ kind: 'removeNode', index: idx + 1, node: rightNode });
          invertedOperations.push({ kind: 'replaceNode', index: idx, oldNode: leftNode, newNode: node });
          newCaret = { nodeId: rightNode.id, offset: 0 };
        }
      }
      break;
    }

    case 'screenplayShiftEnter': {
      // Section 8: Shift+Enter is a soft line break. It must NEVER trigger type transitions.
      const idx = newNodes.findIndex((n) => n.id === command.nodeId);
      if (idx === -1) {
        return { error: `Node ${command.nodeId} not found` };
      }

      const node = newNodes[idx];
      let start = command.offset;
      let end = command.offset;
      if (command.selection) {
        start = Math.min(command.selection.start, command.selection.end);
        end = Math.max(command.selection.start, command.selection.end);
      }

      const newText = node.text.slice(0, start) + '\n' + node.text.slice(end);
      const newNode: ScreenplayNode = normalizeScreenplayNode({
        ...node,
        text: newText,
      });

      newNodes[idx] = newNode;
      operations.push({ kind: 'replaceNode', index: idx, oldNode: node, newNode });
      invertedOperations.push({ kind: 'replaceNode', index: idx, oldNode: newNode, newNode: node });

      newCaret = { nodeId: newNode.id, offset: start + 1 };
      break;
    }

    case 'screenplayTab': {
      // Section 9 & 10: Tab / Shift+Tab semantic type conversion cycle
      const idx = newNodes.findIndex((n) => n.id === command.nodeId);
      if (idx === -1) {
        return { error: `Node ${command.nodeId} not found` };
      }

      const node = newNodes[idx];
      const targetType = command.isShiftTab
        ? getPreviousNodeTypeOnTab(node.type)
        : getNextNodeTypeOnTab(node.type);

      if (targetType === node.type) {
        break;
      }

      let updatedText = node.text;
      if (node.type === 'parenthetical' && targetType !== 'parenthetical') {
        let trimmed = updatedText.trim();
        if (trimmed.startsWith('(')) trimmed = trimmed.slice(1);
        if (trimmed.endsWith(')')) trimmed = trimmed.slice(0, -1);
        updatedText = trimmed;
      }

      const newNode = normalizeScreenplayNode({
        ...node,
        type: targetType,
        text: updatedText,
      });

      newNodes[idx] = newNode;
      operations.push({ kind: 'replaceNode', index: idx, oldNode: node, newNode });
      invertedOperations.push({ kind: 'replaceNode', index: idx, oldNode: newNode, newNode: node });

      newCaret = {
        nodeId: newNode.id,
        offset: Math.min(currentCaret?.offset || 0, newNode.text.length),
      };
      break;
    }

    case 'screenplayBackspace': {
      // Section 12: Backspace rules
      const idx = newNodes.findIndex((n) => n.id === command.nodeId);
      if (idx === -1) {
        return { error: `Node ${command.nodeId} not found` };
      }

      const node = newNodes[idx];

      // Selection delete
      if (command.selection && command.selection.start !== command.selection.end) {
        const start = Math.min(command.selection.start, command.selection.end);
        const end = Math.max(command.selection.start, command.selection.end);
        const newText = node.text.slice(0, start) + node.text.slice(end);
        const newNode = normalizeScreenplayNode({ ...node, text: newText });
        newNodes[idx] = newNode;
        operations.push({ kind: 'replaceNode', index: idx, oldNode: node, newNode });
        invertedOperations.push({ kind: 'replaceNode', index: idx, oldNode: newNode, newNode: node });
        newCaret = { nodeId: node.id, offset: start };
        break;
      }

      // Collapsed cursor offset > 0: normal character deletion
      if (command.offset > 0) {
        const newText = node.text.slice(0, command.offset - 1) + node.text.slice(command.offset);
        const newNode = normalizeScreenplayNode({ ...node, text: newText });
        newNodes[idx] = newNode;
        operations.push({ kind: 'replaceNode', index: idx, oldNode: node, newNode });
        invertedOperations.push({ kind: 'replaceNode', index: idx, oldNode: newNode, newNode: node });
        newCaret = { nodeId: node.id, offset: command.offset - 1 };
        break;
      }

      // Offset === 0
      if (idx === 0) {
        if (node.text.length === 0 && newNodes.length > 1) {
          newNodes.splice(0, 1);
          operations.push({ kind: 'removeNode', index: 0, node });
          invertedOperations.push({ kind: 'insertNode', index: 0, node });
          newCaret = { nodeId: newNodes[0].id, offset: 0 };
        } else if (node.text.length === 0 && node.type !== 'action') {
          const newNode = normalizeScreenplayNode({ ...node, type: 'action' });
          newNodes[0] = newNode;
          operations.push({ kind: 'replaceNode', index: 0, oldNode: node, newNode });
          invertedOperations.push({ kind: 'replaceNode', index: 0, oldNode: newNode, newNode: node });
          newCaret = { nodeId: newNode.id, offset: 0 };
        }
        break;
      }

      const prevNode = newNodes[idx - 1];

      const isNodeEmpty = node.type === 'parenthetical'
        ? node.text.replace(/[()]/g, '').trim().length === 0
        : node.text.length === 0;

      if (isNodeEmpty) {
        if (node.type === 'parenthetical') {
          const newNode = normalizeScreenplayNode({ ...node, type: 'dialogue', text: '' });
          newNodes[idx] = newNode;
          operations.push({ kind: 'replaceNode', index: idx, oldNode: node, newNode });
          invertedOperations.push({ kind: 'replaceNode', index: idx, oldNode: newNode, newNode: node });
          newCaret = { nodeId: newNode.id, offset: 0 };
          break;
        }

        // Current empty node: delete and place cursor at end of prevNode
        newNodes.splice(idx, 1);
        operations.push({ kind: 'removeNode', index: idx, node });
        invertedOperations.push({ kind: 'insertNode', index: idx, node });
        newCaret = { nodeId: prevNode.id, offset: prevNode.text.length };
        break;
      }

      // Current node has text:
      if (prevNode.type === node.type) {
        // Same type: MERGE
        const prevLen = prevNode.text.length;
        const mergedNode = normalizeScreenplayNode({
          ...prevNode,
          text: prevNode.text + node.text,
        });
        newNodes[idx - 1] = mergedNode;
        newNodes.splice(idx, 1);
        operations.push({ kind: 'replaceNode', index: idx - 1, oldNode: prevNode, newNode: mergedNode });
        operations.push({ kind: 'removeNode', index: idx, node });
        invertedOperations.push({ kind: 'insertNode', index: idx, node });
        invertedOperations.push({ kind: 'replaceNode', index: idx - 1, oldNode: mergedNode, newNode: prevNode });
        newCaret = { nodeId: mergedNode.id, offset: prevLen };
      } else {
        // Different semantic type: BOUNDARY NAVIGATION ONLY (do NOT merge or corrupt AST)
        newCaret = { nodeId: prevNode.id, offset: prevNode.text.length };
      }
      break;
    }

    case 'screenplayDelete': {
      // Section 13: Delete rules
      const idx = newNodes.findIndex((n) => n.id === command.nodeId);
      if (idx === -1) {
        return { error: `Node ${command.nodeId} not found` };
      }

      const node = newNodes[idx];

      if (command.selection && command.selection.start !== command.selection.end) {
        const start = Math.min(command.selection.start, command.selection.end);
        const end = Math.max(command.selection.start, command.selection.end);
        const newText = node.text.slice(0, start) + node.text.slice(end);
        const newNode = normalizeScreenplayNode({ ...node, text: newText });
        newNodes[idx] = newNode;
        operations.push({ kind: 'replaceNode', index: idx, oldNode: node, newNode });
        invertedOperations.push({ kind: 'replaceNode', index: idx, oldNode: newNode, newNode: node });
        newCaret = { nodeId: node.id, offset: start };
        break;
      }

      if (command.offset < node.text.length) {
        const newText = node.text.slice(0, command.offset) + node.text.slice(command.offset + 1);
        const newNode = normalizeScreenplayNode({ ...node, text: newText });
        newNodes[idx] = newNode;
        operations.push({ kind: 'replaceNode', index: idx, oldNode: node, newNode });
        invertedOperations.push({ kind: 'replaceNode', index: idx, oldNode: newNode, newNode: node });
        newCaret = { nodeId: node.id, offset: command.offset };
        break;
      }

      // At end of node
      if (idx < newNodes.length - 1) {
        const nextNode = newNodes[idx + 1];
        if (nextNode.text.length === 0) {
          newNodes.splice(idx + 1, 1);
          operations.push({ kind: 'removeNode', index: idx + 1, node: nextNode });
          invertedOperations.push({ kind: 'insertNode', index: idx + 1, node: nextNode });
          newCaret = { nodeId: node.id, offset: command.offset };
        } else if (nextNode.type === node.type) {
          const mergedNode = normalizeScreenplayNode({
            ...node,
            text: node.text + nextNode.text,
          });
          newNodes[idx] = mergedNode;
          newNodes.splice(idx + 1, 1);
          operations.push({ kind: 'replaceNode', index: idx, oldNode: node, newNode: mergedNode });
          operations.push({ kind: 'removeNode', index: idx + 1, node: nextNode });
          invertedOperations.push({ kind: 'insertNode', index: idx + 1, node: nextNode });
          invertedOperations.push({ kind: 'replaceNode', index: idx, oldNode: mergedNode, newNode: node });
          newCaret = { nodeId: mergedNode.id, offset: command.offset };
        } else {
          // Different type: boundary navigation to start of next node
          newCaret = { nodeId: nextNode.id, offset: 0 };
        }
      }
      break;
    }

    case 'clearAllNodes': {
      const singleNode: ScreenplayNode = normalizeScreenplayNode({
        id: generateId('node'),
        type: 'sceneHeading',
        text: '',
        sceneId: 'sc_init',
        attrs: { sceneNumber: '1' },
      });
      newNodes = [singleNode];
      newCaret = { nodeId: singleNode.id, offset: 0 };
      break;
    }

    case 'replaceAllNodesWithChar': {
      const singleNode: ScreenplayNode = normalizeScreenplayNode({
        id: generateId('node'),
        type: 'sceneHeading',
        text: command.char || '',
        sceneId: 'sc_init',
        attrs: { sceneNumber: '1' },
      });
      newNodes = [singleNode];
      newCaret = { nodeId: singleNode.id, offset: singleNode.text.length };
      break;
    }

    case 'applyInlineFormat': {
      const idx = newNodes.findIndex((n) => n.id === command.nodeId);
      if (idx !== -1) {
        const node = newNodes[idx];
        let newText = node.text;
        const start = command.selection ? Math.min(command.selection.start, command.selection.end) : 0;
        const end = command.selection ? Math.max(command.selection.start, command.selection.end) : node.text.length;

        let addedChars = 0;
        if (command.format === 'uppercase') {
          if (start !== end) {
            newText = node.text.slice(0, start) + node.text.slice(start, end).toUpperCase() + node.text.slice(end);
          } else {
            newText = node.text.toUpperCase();
          }
        } else if (command.format === 'bold') {
          if (start !== end) {
            const selected = node.text.slice(start, end);
            if (selected.startsWith('<strong>') && selected.endsWith('</strong>')) {
              newText = node.text.slice(0, start) + selected.slice(8, -9) + node.text.slice(end);
              addedChars = -17;
            } else {
              newText = node.text.slice(0, start) + `<strong>${selected}</strong>` + node.text.slice(end);
              addedChars = 17;
            }
          } else {
            if (node.text.startsWith('<strong>') && node.text.endsWith('</strong>')) {
              newText = node.text.slice(8, -9);
            } else {
              newText = `<strong>${node.text}</strong>`;
            }
          }
        } else if (command.format === 'italic') {
          if (start !== end) {
            const selected = node.text.slice(start, end);
            if (selected.startsWith('<em>') && selected.endsWith('</em>')) {
              newText = node.text.slice(0, start) + selected.slice(4, -5) + node.text.slice(end);
              addedChars = -9;
            } else {
              newText = node.text.slice(0, start) + `<em>${selected}</em>` + node.text.slice(end);
              addedChars = 9;
            }
          } else {
            if (node.text.startsWith('<em>') && node.text.endsWith('</em>')) {
              newText = node.text.slice(4, -5);
            } else {
              newText = `<em>${node.text}</em>`;
            }
          }
        } else if (command.format === 'underline') {
          if (start !== end) {
            const selected = node.text.slice(start, end);
            if (selected.startsWith('<u>') && selected.endsWith('</u>')) {
              newText = node.text.slice(0, start) + selected.slice(3, -4) + node.text.slice(end);
              addedChars = -7;
            } else {
              newText = node.text.slice(0, start) + `<u>${selected}</u>` + node.text.slice(end);
              addedChars = 7;
            }
          } else {
            if (node.text.startsWith('<u>') && node.text.endsWith('</u>')) {
              newText = node.text.slice(3, -4);
            } else {
              newText = `<u>${node.text}</u>`;
            }
          }
        }

        const newNode = normalizeScreenplayNode({ ...node, text: newText });
        newNodes[idx] = newNode;
        operations.push({ kind: 'replaceNode', index: idx, oldNode: node, newNode });
        invertedOperations.push({ kind: 'replaceNode', index: idx, oldNode: newNode, newNode: node });

        const targetOffset = start !== end ? Math.max(0, end + addedChars) : newText.length;
        newCaret = { nodeId: node.id, offset: targetOffset };
      }
      break;
    }

    case 'screenplayEscape': {
      // Section 14: Escape is a UI/focus command only. Never mutates AST.
      return {
        newDoc: doc,
        newCaret: currentCaret,
        transaction: {
          id: generateId('tx'),
          docId,
          timestamp: Date.now(),
          commandType: 'screenplayEscape',
          operations: [],
          invertedOperations: [],
          beforeCaret: currentCaret,
          afterCaret: currentCaret,
        },
      };
    }

    default:
      return { error: `Unknown command type: ${(command as any).type}` };
  }

  const transaction: SemanticTransaction = {
    id: generateId('tx'),
    docId,
    timestamp: Date.now(),
    commandType: command.type,
    operations,
    invertedOperations,
    beforeCaret: currentCaret,
    afterCaret: newCaret,
  };

  const newDoc: ScreenplayDocument = {
    ...doc,
    nodes: newNodes,
    scenes: newScenes,
    version: doc.version + 1,
    updatedAt: Date.now(),
  };

  return {
    newDoc,
    newCaret,
    transaction,
  };
}
