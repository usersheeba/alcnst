/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ScreenplayNode, ScreenplayNodeType, ProseNode } from '../types';

/**
 * Screenplay Physical Metric Specification
 * Fundamental rule: NO PIXELS.
 * All measurements in inches (in) and PostScript points (pt).
 * 1 in = 72 pt.
 * Standard Courier 12pt: 10 CPI (Characters Per Inch). 1 in = 10 chars.
 * Line height: strictly 12pt (6 lines per inch).
 */

export const POINTS_PER_INCH = 72;
export const CHARS_PER_INCH = 10;
export const LINE_HEIGHT_PT = 12;
export const FONT_SIZE_PT = 12;

export type PageFormat = 'US_LETTER' | 'A4';

export interface PageGeometry {
  format: PageFormat;
  name: string;
  widthIn: number;
  heightIn: number;
  widthPt: number;
  heightPt: number;
  linesPerPage: number;
  marginLeftIn: number;
  marginRightIn: number;
  marginTopIn: number;
  marginBottomIn: number;
  pageNumberTopIn: number;
  pageNumberRightIn: number;
}

export const PAGE_GEOMETRIES: Record<PageFormat, PageGeometry> = {
  US_LETTER: {
    format: 'US_LETTER',
    name: 'US Letter',
    widthIn: 8.5,
    heightIn: 11.0,
    widthPt: 612,
    heightPt: 792,
    linesPerPage: 54, // (792 - 72 - 72) / 12 = 54 lines
    marginLeftIn: 1.5,
    marginRightIn: 1.0,
    marginTopIn: 1.0,
    marginBottomIn: 1.0,
    pageNumberTopIn: 0.5,
    pageNumberRightIn: 1.0,
  },
  A4: {
    format: 'A4',
    name: 'A4',
    widthIn: 210 / 25.4, // 8.2677 in
    heightIn: 297 / 25.4, // 11.6929 in
    widthPt: 595.28,
    heightPt: 841.89,
    linesPerPage: 58, // Math.floor((841.89 - 72 - 72) / 12) = 58 lines
    // Crucial: Keep identical inch margins for A4 (Final Draft standard)
    marginLeftIn: 1.5,
    marginRightIn: 1.0,
    marginTopIn: 1.0,
    marginBottomIn: 1.0,
    pageNumberTopIn: 0.5,
    pageNumberRightIn: 1.0,
  },
};

export interface ElementFormatSpec {
  type: ScreenplayNodeType;
  name: string;
  leftIn: number; // Distance from page left edge
  rightIn: number; // Distance from page right edge
  align: 'left' | 'right' | 'center';
  uppercase: boolean;
  marginTopLines: number;
  marginBottomLines: number;
  keepWithNext: boolean;
}

/**
 * Industry standard Final Draft element indentation matrix.
 * Left is measured from page left edge.
 * Right is measured from page right edge.
 */
export const ELEMENT_SPECS: Record<ScreenplayNodeType, ElementFormatSpec> = {
  sceneHeading: {
    type: 'sceneHeading',
    name: 'Scene Heading',
    leftIn: 1.5,
    rightIn: 1.0,
    align: 'left',
    uppercase: true,
    marginTopLines: 1,
    marginBottomLines: 1,
    keepWithNext: true,
  },
  action: {
    type: 'action',
    name: 'Action',
    leftIn: 1.5,
    rightIn: 1.0,
    align: 'left',
    uppercase: false,
    marginTopLines: 0,
    marginBottomLines: 1,
    keepWithNext: false,
  },
  character: {
    type: 'character',
    name: 'Character',
    leftIn: 3.5,
    rightIn: 2.0,
    align: 'left',
    uppercase: true,
    marginTopLines: 1,
    marginBottomLines: 0,
    keepWithNext: true,
  },
  parenthetical: {
    type: 'parenthetical',
    name: 'Parenthetical',
    leftIn: 3.1,
    rightIn: 2.9,
    align: 'left',
    uppercase: false,
    marginTopLines: 0,
    marginBottomLines: 0,
    keepWithNext: true,
  },
  dialogue: {
    type: 'dialogue',
    name: 'Dialogue',
    leftIn: 2.3,
    rightIn: 2.1,
    align: 'left',
    uppercase: false,
    marginTopLines: 0,
    marginBottomLines: 1,
    keepWithNext: false,
  },
  transition: {
    type: 'transition',
    name: 'Transition',
    leftIn: 1.5,
    rightIn: 1.0,
    align: 'right',
    uppercase: true,
    marginTopLines: 1,
    marginBottomLines: 1,
    keepWithNext: false,
  },
  shot: {
    type: 'shot',
    name: 'Shot',
    leftIn: 1.5,
    rightIn: 1.0,
    align: 'left',
    uppercase: true,
    marginTopLines: 1,
    marginBottomLines: 1,
    keepWithNext: false,
  },
  textNote: {
    type: 'textNote',
    name: 'Note',
    leftIn: 1.5,
    rightIn: 1.0,
    align: 'left',
    uppercase: false,
    marginTopLines: 0,
    marginBottomLines: 1,
    keepWithNext: false,
  },
  newAct: {
    type: 'newAct',
    name: 'New Act',
    leftIn: 1.5,
    rightIn: 1.0,
    align: 'center',
    uppercase: true,
    marginTopLines: 2,
    marginBottomLines: 1,
    keepWithNext: true,
  },
  endOfAct: {
    type: 'endOfAct',
    name: 'End of Act',
    leftIn: 1.5,
    rightIn: 1.0,
    align: 'center',
    uppercase: true,
    marginTopLines: 2,
    marginBottomLines: 1,
    keepWithNext: false,
  },
  outline: {
    type: 'outline',
    name: 'Outline',
    leftIn: 1.5,
    rightIn: 1.0,
    align: 'left',
    uppercase: false,
    marginTopLines: 1,
    marginBottomLines: 1,
    keepWithNext: false,
  },
};

/**
 * Margin Collapsing:
 * If previous element marginBottom = 1 and next element marginTop = 1,
 * do NOT sum them. Take max(prev.bottom, next.top).
 * Example:
 * Action -> Character gives max(1, 1) = 1 blank line.
 * Character -> Dialogue gives max(0, 0) = 0 blank lines.
 * Dialogue -> Action gives max(1, 0) = 1 blank line.
 */
export function collapseMargins(
  prevType: ScreenplayNodeType | null,
  nextType: ScreenplayNodeType
): number {
  if (!prevType) return 0; // Top of page has no margin
  const prevBottom = ELEMENT_SPECS[prevType]?.marginBottomLines ?? 0;
  const nextTop = ELEMENT_SPECS[nextType]?.marginTopLines ?? 0;
  return Math.max(prevBottom, nextTop);
}

/**
 * Calculate maximum characters per line for an element given page format
 * Width available = pageWidth - left - right
 * At 10 CPI: maxChars = Math.floor(widthIn * 10)
 */
export function getMaxCharsPerLine(
  type: ScreenplayNodeType,
  format: PageFormat = 'US_LETTER'
): number {
  const geom = PAGE_GEOMETRIES[format];
  const spec = ELEMENT_SPECS[type] || ELEMENT_SPECS.action;
  const availableWidthIn = geom.widthIn - spec.leftIn - spec.rightIn;
  return Math.max(1, Math.floor(availableWidthIn * CHARS_PER_INCH));
}

/**
 * Strips HTML tags and decodes common entities to obtain visible plain text.
 */
export function stripHtmlTags(text: string): string {
  if (!text) return '';
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Wraps text into lines according to 10 CPI monospace rule and max line width.
 * Preserves intentional soft breaks (\n) and handles word boundaries.
 */
export function wrapTextToLines(text: string, maxChars: number): string[] {
  if (!text || text.length === 0) {
    return [''];
  }

  // Normalize HTML breaks to standard newlines
  const normalizedText = text.replace(/<br\s*\/?>/gi, '\n');
  const rawParagraphs = normalizedText.split('\n');
  const wrappedLines: string[] = [];

  for (const para of rawParagraphs) {
    if (para.length === 0) {
      wrappedLines.push('');
      continue;
    }

    const words = para.split(' ');
    let currentLine = '';

    for (const word of words) {
      if (word.length === 0) {
        // Multiple consecutive spaces
        currentLine += ' ';
        continue;
      }

      const wordVisualLen = stripHtmlTags(word).length;

      // If word itself is wider than line, break word
      if (wordVisualLen > maxChars) {
        if (currentLine.length > 0) {
          wrappedLines.push(currentLine);
          currentLine = '';
        }
        let remainingWord = word;
        while (stripHtmlTags(remainingWord).length > maxChars) {
          wrappedLines.push(remainingWord.slice(0, maxChars));
          remainingWord = remainingWord.slice(maxChars);
        }
        currentLine = remainingWord;
        continue;
      }

      const currentLineVisualLen = stripHtmlTags(currentLine).length;
      const testLineVisualLen = currentLine.length === 0 ? wordVisualLen : currentLineVisualLen + 1 + wordVisualLen;

      if (testLineVisualLen <= maxChars) {
        currentLine = currentLine.length === 0 ? word : `${currentLine} ${word}`;
      } else {
        if (currentLine.length > 0) {
          wrappedLines.push(currentLine);
        }
        currentLine = word;
      }
    }

    if (currentLine.length > 0) {
      wrappedLines.push(currentLine);
    }
  }

  return wrappedLines.length > 0 ? wrappedLines : [''];
}

export interface PaginationOptions {
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
}

export type PaginatedLineType = ScreenplayNodeType | 'more' | 'contd' | 'sceneContinuedBottom' | 'sceneContinuedTop';

export interface PaginatedLine {
  text: string;
  type: PaginatedLineType;
  nodeId?: string;
  align: 'left' | 'right' | 'center';
  leftIn: number;
  rightIn: number;
  isContinuation?: boolean;
}

export interface ScreenplayPage {
  pageNumber: number;
  lines: PaginatedLine[];
  lineCount: number;
  startsAtNodeIndex: number;
  endsAtNodeIndex: number;
}

/**
 * Deterministic Line-Count Pagination Engine (Section 5)
 * Lines per page: US Letter = 54 lines, A4 = 58 lines.
 * Line height = 12pt.
 * Rules:
 * 1. Scene Heading keepWithNext: cannot sit alone on bottom of page.
 * 2. Character keepWithNext: cannot sit alone on bottom of page without dialogue.
 * 3. Parenthetical keepWithNext: cannot sit alone on bottom of page without dialogue.
 * 4. Widow/orphan control: do not leave a single line of multi-line dialogue alone.
 * 5. Dialogue split:
 *    - append (MORE) at bottom of page
 *    - start next page with CHARACTER (CONT'D)
 * 6. Scene continuation:
 *    - append (CONTINUED) at bottom of page
 *    - start next page with CONTINUED: at top
 */
export function paginateScreenplayDocument(
  nodes: ScreenplayNode[],
  format: PageFormat = 'US_LETTER',
  options?: PaginationOptions
): ScreenplayPage[] {
  const geom = PAGE_GEOMETRIES[format];
  const maxLines = geom.linesPerPage;

  if (nodes.length === 0) {
    return [
      {
        pageNumber: 1,
        lines: [],
        lineCount: 0,
        startsAtNodeIndex: 0,
        endsAtNodeIndex: 0,
      },
    ];
  }

  const pages: ScreenplayPage[] = [];
  let currentPageLines: PaginatedLine[] = [];
  let currentPageNumber = 1;
  let pageStartNodeIndex = 0;
  let prevNodeType: ScreenplayNodeType | null = null;
  let activeCharacterName = '';
  let currentSceneNumber = 0;

  const showMoreAndContd = options?.showMoreAndContd !== false;
  const dialogueMoreBottomEnabled = showMoreAndContd && options?.dialogueMoreBottomEnabled !== false;
  const dialogueMoreText = options?.dialogueMoreText || '(MORE)';
  const dialogueContdTopEnabled = showMoreAndContd && options?.dialogueContdTopEnabled !== false;
  const dialogueContdText = options?.dialogueContdText || "(CONT'D)";
  const sceneContinuedBottomEnabled = showMoreAndContd && Boolean(options?.sceneContinuedBottomEnabled);
  const sceneContinuedBottomText = options?.sceneContinuedBottomText || '(CONTINUED)';
  const sceneContinuedTopEnabled = showMoreAndContd && Boolean(options?.sceneContinuedTopEnabled);
  const sceneContinuedTopText = options?.sceneContinuedTopText || 'CONTINUED:';

  const finalizePage = (endNodeIndex: number, nextNodeIsNewScene = false) => {
    // If scene continuation is enabled and the next node belongs to the same continuing scene
    if (sceneContinuedBottomEnabled && !nextNodeIsNewScene && currentSceneNumber > 0 && currentPageLines.length > 0) {
      currentPageLines.push({
        text: sceneContinuedBottomText,
        type: 'sceneContinuedBottom',
        align: 'right',
        leftIn: ELEMENT_SPECS.sceneHeading.leftIn,
        rightIn: ELEMENT_SPECS.sceneHeading.rightIn,
      });
    }

    pages.push({
      pageNumber: currentPageNumber,
      lines: currentPageLines,
      lineCount: currentPageLines.length,
      startsAtNodeIndex: pageStartNodeIndex,
      endsAtNodeIndex: endNodeIndex,
    });
    currentPageNumber++;
    currentPageLines = [];
    pageStartNodeIndex = endNodeIndex;
    prevNodeType = null;

    // If scene continuation top marker is enabled on the newly opened page
    if (sceneContinuedTopEnabled && !nextNodeIsNewScene && currentSceneNumber > 0 && endNodeIndex < nodes.length) {
      const topText = options?.sceneContinuedNumberEnabled !== false && currentSceneNumber
        ? `${sceneContinuedTopText} (${currentSceneNumber})`
        : sceneContinuedTopText;

      currentPageLines.push({
        text: topText,
        type: 'sceneContinuedTop',
        align: 'left',
        leftIn: ELEMENT_SPECS.sceneHeading.leftIn,
        rightIn: ELEMENT_SPECS.sceneHeading.rightIn,
      });
    }
  };

  for (let nodeIdx = 0; nodeIdx < nodes.length; nodeIdx++) {
    const node = nodes[nodeIdx];
    const spec = ELEMENT_SPECS[node.type] || ELEMENT_SPECS.action;
    const maxChars = getMaxCharsPerLine(node.type, format);

    if (node.type === 'sceneHeading') {
      currentSceneNumber++;
    }

    if (node.type === 'character') {
      activeCharacterName = node.text.trim();
    }

    // Explicit manual page break
    if (node.attrs?.pageBreakBefore && currentPageLines.length > 0) {
      finalizePage(nodeIdx, node.type === 'sceneHeading');
    }

    // Compute margin collapsing
    const marginBlankLines = currentPageLines.length === 0
      ? 0
      : collapseMargins(prevNodeType, node.type);

    let nodeText = node.text;
    if (node.type === 'parenthetical') {
      let inner = nodeText.trim();
      if (inner.startsWith('(')) inner = inner.slice(1);
      if (inner.endsWith(')')) inner = inner.slice(0, -1);
      nodeText = `(${inner})`;
    }

    const wrappedLines = wrapTextToLines(
      spec.uppercase ? nodeText.toUpperCase() : nodeText,
      maxChars
    );

    const neededLines = marginBlankLines + wrappedLines.length;

    // Check keepWithNext rules
    let minLinesRequired = neededLines;
    if (spec.keepWithNext && nodeIdx < nodes.length - 1) {
      const nextNode = nodes[nodeIdx + 1];
      const nextMargin = collapseMargins(node.type, nextNode.type);
      minLinesRequired += nextMargin + 1;
    }

    // Check if entire block fits on current page
    if (currentPageLines.length + minLinesRequired <= maxLines) {
      // It fits!
      for (let m = 0; m < marginBlankLines; m++) {
        currentPageLines.push({
          text: '',
          type: 'action',
          align: 'left',
          leftIn: spec.leftIn,
          rightIn: spec.rightIn,
        });
      }
      for (const lineText of wrappedLines) {
        currentPageLines.push({
          text: lineText,
          type: node.type,
          nodeId: node.id,
          align: spec.align,
          leftIn: spec.leftIn,
          rightIn: spec.rightIn,
        });
      }
      prevNodeType = node.type;
    } else {
      // Does not fit!
      // If block has keepWithNext and does not fit, push entire block to next page
      if (spec.keepWithNext) {
        if (currentPageLines.length > 0) {
          finalizePage(nodeIdx, node.type === 'sceneHeading');
        }
        // Place on new page
        for (const lineText of wrappedLines) {
          currentPageLines.push({
            text: lineText,
            type: node.type,
            nodeId: node.id,
            align: spec.align,
            leftIn: spec.leftIn,
            rightIn: spec.rightIn,
          });
        }
        prevNodeType = node.type;
      } else if (node.type === 'dialogue' && wrappedLines.length >= 2 && showMoreAndContd) {
        // Dialogue split across page with (MORE) and (CONT'D)
        const availableLinesOnCurrentPage = maxLines - currentPageLines.length - marginBlankLines;

        // Need at least 2 lines of dialogue before (MORE) to avoid orphan
        if (availableLinesOnCurrentPage >= 3) {
          // Add margin
          for (let m = 0; m < marginBlankLines; m++) {
            currentPageLines.push({
              text: '',
              type: 'action',
              align: 'left',
              leftIn: spec.leftIn,
              rightIn: spec.rightIn,
            });
          }

          const linesForFirstPage = availableLinesOnCurrentPage - 1; // reserve 1 line for (MORE)
          for (let i = 0; i < linesForFirstPage; i++) {
            currentPageLines.push({
              text: wrappedLines[i],
              type: 'dialogue',
              nodeId: node.id,
              align: spec.align,
              leftIn: spec.leftIn,
              rightIn: spec.rightIn,
            });
          }

          // Append (MORE) if enabled
          if (dialogueMoreBottomEnabled) {
            currentPageLines.push({
              text: dialogueMoreText,
              type: 'more',
              nodeId: node.id,
              align: 'left',
              leftIn: spec.leftIn,
              rightIn: spec.rightIn,
            });
          }

          // Break to next page (continuing same dialogue/scene)
          finalizePage(nodeIdx, false);

          // Top of next page: Character (CONT'D) if enabled
          if (dialogueContdTopEnabled) {
            currentPageLines.push({
              text: `${activeCharacterName || 'CHARACTER'} ${dialogueContdText}`,
              type: 'contd',
              nodeId: node.id,
              align: 'left',
              leftIn: ELEMENT_SPECS.character.leftIn,
              rightIn: ELEMENT_SPECS.character.rightIn,
            });
          }

          // Remaining dialogue lines
          for (let i = linesForFirstPage; i < wrappedLines.length; i++) {
            currentPageLines.push({
              text: wrappedLines[i],
              type: 'dialogue',
              nodeId: node.id,
              align: spec.align,
              leftIn: spec.leftIn,
              rightIn: spec.rightIn,
              isContinuation: true,
            });
          }
          prevNodeType = 'dialogue';
        } else {
          // Not enough room for a clean dialogue split; push whole dialogue to next page
          if (currentPageLines.length > 0) {
            finalizePage(nodeIdx, false);
          }
          for (const lineText of wrappedLines) {
            currentPageLines.push({
              text: lineText,
              type: node.type,
              nodeId: node.id,
              align: spec.align,
              leftIn: spec.leftIn,
              rightIn: spec.rightIn,
            });
          }
          prevNodeType = node.type;
        }
      } else {
        // Standard block overflow (Action, etc.): push to next page
        if (currentPageLines.length > 0) {
          finalizePage(nodeIdx, node.type === 'sceneHeading');
        }
        for (const lineText of wrappedLines) {
          currentPageLines.push({
            text: lineText,
            type: node.type,
            nodeId: node.id,
            align: spec.align,
            leftIn: spec.leftIn,
            rightIn: spec.rightIn,
          });
        }
        prevNodeType = node.type;
      }
    }
  }

  if (currentPageLines.length > 0 || pages.length === 0) {
    finalizePage(nodes.length - 1, true);
  }

  return pages;
}

export interface ProsePage {
  pageNumber: number;
  startsAtNodeIndex: number;
  endsAtNodeIndex: number;
  lineCount: number;
}

export function paginateProseDocument(nodes: ProseNode[]): ProsePage[] {
  // Prose has roughly 28 lines per page at 17px font-size and 1.8 leading
  const maxLines = 28;
  if (nodes.length === 0) {
    return [{ pageNumber: 1, startsAtNodeIndex: 0, endsAtNodeIndex: 0, lineCount: 0 }];
  }

  const pages: ProsePage[] = [];
  let currentPageLines = 0;
  let pageStartNodeIndex = 0;
  let currentPageNumber = 1;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    // Chars per line in standard prose width (max-w-[680px], ~6.5in printable width)
    const charsPerLine = 75;
    
    // Split text by manual newlines if the user typed them inside the paragraph node
    const paragraphsText = node.text.split('\n');
    let nodeLines = 0;
    for (const para of paragraphsText) {
      const wrapped = wrapTextToLines(para, charsPerLine);
      nodeLines += wrapped.length;
    }

    // Add paragraph separator spacing of 1 line between paragraphs
    const neededLines = nodeLines + (currentPageLines > 0 ? 1 : 0);

    if (currentPageLines + neededLines <= maxLines || currentPageLines === 0) {
      currentPageLines += neededLines;
    } else {
      // Finalize current page and start next page
      pages.push({
        pageNumber: currentPageNumber,
        startsAtNodeIndex: pageStartNodeIndex,
        endsAtNodeIndex: i - 1,
        lineCount: currentPageLines,
      });
      currentPageNumber++;
      pageStartNodeIndex = i;
      currentPageLines = nodeLines;
    }
  }

  // Final page
  pages.push({
    pageNumber: currentPageNumber,
    startsAtNodeIndex: pageStartNodeIndex,
    endsAtNodeIndex: nodes.length - 1,
    lineCount: currentPageLines,
  });

  return pages;
}
