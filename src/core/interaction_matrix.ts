/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ScreenplayNodeType } from '../types';

export interface InteractionRule {
  key: string;
  semanticResult: string;
  visualResult: string;
  cursorPosition: string;
  selectionBehavior: string;
  undoBehavior: string;
  edgeCases: string;
}

export const ALT_KEY_TYPE_MAP: Record<string, ScreenplayNodeType> = {
  '1': 'sceneHeading',
  '2': 'action',
  '3': 'character',
  '4': 'parenthetical',
  '5': 'dialogue',
  '6': 'transition',
  '7': 'shot',
  '8': 'textNote',
};

export const SCREENPLAY_INTERACTION_MATRIX: InteractionRule[] = [
  {
    key: 'Enter',
    semanticResult:
      'Evaluates screenplay grammar transition. On non-empty node at end of text: sceneHeading -> action, character -> dialogue, parenthetical -> dialogue, dialogue -> character, transition -> sceneHeading. Mid-text: splits into two nodes (sceneHeading split creates action for second part). On empty node: structural escape (empty dialogue/character -> action, empty parenthetical -> dialogue).',
    visualResult:
      'Creates a new line indented and styled according to the target semantic element without extra margin flickering.',
    cursorPosition:
      'Placed at offset 0 of newly inserted or converted node.',
    selectionBehavior:
      'If text was selected, replaces selection with a split/newline.',
    undoBehavior:
      'Restores previous node state and merges split nodes or removes inserted node, returning cursor to exact pre-Enter coordinates.',
    edgeCases:
      'Enter at offset 0 of non-empty node inserts preceding action node without destroying text. Enter in dialogue after character advances dialogue.',
  },
  {
    key: 'Shift+Enter',
    semanticResult:
      'Inserts a literal line break (\\n) within the same node text without mutating node type or inserting a new AST block.',
    visualResult:
      'Moves cursor down one line within the same block with identical margins and indentation.',
    cursorPosition:
      'Immediately after the inserted newline character.',
    selectionBehavior:
      'Replaces active selection with a newline.',
    undoBehavior:
      'Atomic text undo restores text without the newline character.',
    edgeCases:
      'Useful for multi-line action descriptions or multi-line dialogue without creating extraneous AST nodes.',
  },
  {
    key: 'Tab',
    semanticResult:
      'Cycles element type forward: action -> character -> transition -> sceneHeading -> shot -> action. In dialogue: dialogue -> parenthetical -> dialogue.',
    visualResult:
      'Re-indents block instantly to the new element margins and updates font casing (e.g. character uppercased, parenthetical wrapped in parens).',
    cursorPosition:
      'Preserves character offset within the text length; adjusts if text length changed due to casing or parenthesis wrapping.',
    selectionBehavior:
      'Maintains active text selection across the type change.',
    undoBehavior:
      'Restores original element type and original text formatting.',
    edgeCases:
      'Tab in parenthetical strips outer parens and converts to dialogue; Tab in character converts to transition.',
  },
  {
    key: 'Shift+Tab',
    semanticResult:
      'Cycles element type backward: character -> action, transition -> character, parenthetical -> dialogue, dialogue -> parenthetical, sceneHeading -> transition, shot -> sceneHeading.',
    visualResult:
      'Re-indents block to previous element margins and restores casing.',
    cursorPosition:
      'Preserves character offset within text length.',
    selectionBehavior:
      'Preserves active selection.',
    undoBehavior:
      'Restores forward element type.',
    edgeCases:
      'Shift+Tab on action remains action or cycles to shot.',
  },
  {
    key: 'Escape',
    semanticResult:
      'CRITICAL INVARIANT: NEVER modifies document AST, NEVER changes node types, NEVER deletes text.',
    visualResult:
      'Blurs active editor element, closes any active popovers/palettes, keeps document layout perfectly intact.',
    cursorPosition:
      'Maintains last caret position or blurs focus safely.',
    selectionBehavior:
      'Preserves selection without alteration.',
    undoBehavior:
      'No transaction generated; undo stack untouched.',
    edgeCases:
      'Pressing Escape rapidly in any node produces zero AST changes or state drift.',
  },
  {
    key: 'Backspace',
    semanticResult:
      'At offset 0 on empty node: deletes empty node (or demotes character/parenthetical to action). At offset 0 on non-empty node: if previous node is same type, merges text; if different type, moves cursor to end of previous node without destroying structure.',
    visualResult:
      'Cleanly joins text or removes empty block without layout shudder.',
    cursorPosition:
      'At end of previous node or merge junction.',
    selectionBehavior:
      'If text selected, deletes selection.',
    undoBehavior:
      'Re-splits merged nodes or re-inserts deleted node at previous index.',
    edgeCases:
      'Backspace in first node of document does nothing if offset is 0. Sole node in document cannot be deleted.',
  },
  {
    key: 'Delete',
    semanticResult:
      'At end of node (offset = text.length): if next node is empty, removes next node; if next node is same type, merges next node into current node; if different type, moves cursor or joins text safely.',
    visualResult:
      'Pulls trailing line or removes trailing empty line.',
    cursorPosition:
      'Remains at merge junction.',
    selectionBehavior:
      'Deletes forward selected range.',
    undoBehavior:
      'Re-splits pulled line or restores deleted next node.',
    edgeCases:
      'Delete at end of last node in document is a no-op.',
  },
  {
    key: 'Arrow Keys (Up/Down/Left/Right)',
    semanticResult:
      'Non-destructive cursor navigation across node boundaries.',
    visualResult:
      'Cursor moves smoothly between lines and elements.',
    cursorPosition:
      'Left at offset 0 jumps to end of previous node. Right at offset length jumps to start of next node. Up on first line jumps to previous node. Down on last line jumps to next node.',
    selectionBehavior:
      'Standard arrow moves collapse selection; Shift+Arrow expands selection within the node.',
    undoBehavior:
      'Navigation does not create undo transactions.',
    edgeCases:
      'Reaching beginning or end of entire script stops at document boundary.',
  },
  {
    key: 'Home / End',
    semanticResult:
      'Navigates cursor to offset 0 (Home) or offset length (End) within the current node.',
    visualResult:
      'Moves cursor without page jumping.',
    cursorPosition:
      'Home: offset 0. End: node.text.length.',
    selectionBehavior:
      'Shift+Home / Shift+End selects from current position to boundary.',
    undoBehavior:
      'No undo transaction.',
    edgeCases:
      'Multi-line nodes move to start/end of line or block depending on OS convention.',
  },
  {
    key: 'Mod-Z / Mod-Shift-Z',
    semanticResult:
      'Executes reversible undo / redo on the current document isolated transaction journal.',
    visualResult:
      'Instantly reverts or re-applies exact AST node state, types, and text.',
    cursorPosition:
      'Restores the exact beforeCaret or afterCaret stored in the transaction.',
    selectionBehavior:
      'Collapses to stored caret coordinate.',
    undoBehavior:
      'Pushes to opposite stack (undo pushes to redo, redo pushes to undo).',
    edgeCases:
      'Switching documents maintains separate, isolated undo stacks per document.',
  },
  {
    key: 'Alt+1..8',
    semanticResult:
      'Instant semantic element conversion: 1=sceneHeading, 2=action, 3=character, 4=parenthetical, 5=dialogue, 6=transition, 7=shot, 8=textNote.',
    visualResult:
      'Immediate style and indentation update; applies uppercase to character/sceneHeading and parens to parenthetical.',
    cursorPosition:
      'Preserved at current offset within text.',
    selectionBehavior:
      'Preserved.',
    undoBehavior:
      'Reverts to previous element type and text.',
    edgeCases:
      'Works identically with Russian Cyrillic and English text.',
  },
];
