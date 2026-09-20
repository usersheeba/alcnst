/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ScreenplayDocument,
  ScreenplayNode,
  CaretPosition,
  SemanticTransaction,
  Operation,
} from '../types';

export class HistoryManager {
  private undoStack: SemanticTransaction[] = [];
  private redoStack: SemanticTransaction[] = [];
  private maxStackDepth: number = 100;

  constructor(maxDepth: number = 100) {
    this.maxStackDepth = maxDepth;
  }

  public push(transaction: SemanticTransaction): void {
    if (transaction.operations.length === 0) return;
    this.undoStack.push(transaction);
    if (this.undoStack.length > this.maxStackDepth) {
      this.undoStack.shift();
    }
    // Any new forward edit clears redo
    this.redoStack = [];
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public undo(currentDoc: ScreenplayDocument): {
    newDoc: ScreenplayDocument;
    caret: CaretPosition | null;
  } | null {
    const tx = this.undoStack.pop();
    if (!tx) return null;

    const newNodes = [...currentDoc.nodes];
    const newScenes = { ...currentDoc.scenes };

    // Apply inverted operations in reverse order
    for (let i = tx.invertedOperations.length - 1; i >= 0; i--) {
      const op = tx.invertedOperations[i];
      this.applyOperation(op, newNodes, newScenes);
    }

    this.redoStack.push(tx);

    const newDoc: ScreenplayDocument = {
      ...currentDoc,
      nodes: newNodes,
      scenes: newScenes,
      version: currentDoc.version + 1,
      updatedAt: Date.now(),
    };

    return {
      newDoc,
      caret: tx.beforeCaret,
    };
  }

  public redo(currentDoc: ScreenplayDocument): {
    newDoc: ScreenplayDocument;
    caret: CaretPosition | null;
  } | null {
    const tx = this.redoStack.pop();
    if (!tx) return null;

    const newNodes = [...currentDoc.nodes];
    const newScenes = { ...currentDoc.scenes };

    // Apply forward operations
    for (let i = 0; i < tx.operations.length; i++) {
      const op = tx.operations[i];
      this.applyOperation(op, newNodes, newScenes);
    }

    this.undoStack.push(tx);

    const newDoc: ScreenplayDocument = {
      ...currentDoc,
      nodes: newNodes,
      scenes: newScenes,
      version: currentDoc.version + 1,
      updatedAt: Date.now(),
    };

    return {
      newDoc,
      caret: tx.afterCaret,
    };
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  private applyOperation(
    op: Operation,
    nodes: ScreenplayNode[],
    scenes: Record<string, any>
  ): void {
    switch (op.kind) {
      case 'replaceNode':
        nodes[op.index] = op.newNode;
        break;
      case 'insertNode':
        nodes.splice(op.index, 0, op.node);
        break;
      case 'removeNode':
        nodes.splice(op.index, 1);
        break;
      case 'updateSceneMeta':
        if (op.newMeta) {
          scenes[op.sceneId] = op.newMeta;
        } else if (op.oldMeta) {
          delete scenes[op.sceneId];
        }
        break;
    }
  }
}
