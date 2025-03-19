import { getStringWidth } from "./get-string-width";

// ANSI escape sequence regex
const ANSI_REGEX = /\u001B(?:\[(?:\d+(?:;\d+)*)?m|\]8;;(?:.*?)(?:\u0007|\u001B\\))/g;

// For text segmentation
const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

// Segment type that includes styling information
type StyledSegment = {
  content: string;
  visibleLength: number;
  before: string; // ANSI sequences that apply to this segment
  after: string;  // ANSI sequences that close styling for this segment
};

/**
 * Processes a string with ANSI escape sequences and divides it into styled segments
 * @param input String with ANSI escape sequences
 * @returns Array of styled segments
 */
function processIntoStyledSegments(input: string): StyledSegment[] {
  // If no ANSI sequences, return a single segment
  if (!input.includes('\u001B')) {
    return [{
      content: input,
      visibleLength: getStringWidth(input, {
        wideWidth: 1,
        fullWidth: 1,
      }),
      before: '',
      after: ''
    }];
  }

  // Split string by ANSI escape sequences
  const parts = input.split(ANSI_REGEX);
  const matches = Array.from(input.matchAll(ANSI_REGEX), m => m[0]);

  const segments: StyledSegment[] = [];

  // Track all opening and closing ANSI sequences
  const openingSequences: string[] = [];
  const closingSequences: string[] = [];

  // Process each ANSI sequence first to identify all opening and closing sequences
  for (const ansi of matches) {
    // Reset code - full reset
    if (ansi === '\u001B[0m') {
      closingSequences.push(ansi);
      continue;
    }

    // Hyperlink closing
    if (ansi === '\u001B]8;;\u0007') {
      closingSequences.push(ansi);
      continue;
    }

    // Other reset codes like 39m, 49m, 22m, etc.
    if (ansi.startsWith('\u001B[') && ansi.endsWith('m')) {
      const code = ansi.slice(2, -1);
      if (['0', '39', '49', '22', '23', '24', '27', '28', '29'].includes(code)) {
        closingSequences.push(ansi);
        continue;
      }
    }

    // Otherwise, treat it as an opening sequence
    openingSequences.push(ansi);
  }

  // Now process the text parts
  const activeStyles: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    const text = parts[i];

    // Process ANSI code before this text part
    if (i > 0 && matches[i-1]) {
      const ansi = matches[i-1];

      // Full reset - clear all active styles
      if (ansi === '\u001B[0m') {
        activeStyles.length = 0;
      }
      // Hyperlink closing
      else if (ansi === '\u001B]8;;\u0007') {
        const index = activeStyles.findIndex(s => s.startsWith('\u001B]8;;') && !s.endsWith('\u001B]8;;\u0007'));
        if (index !== -1) {
          activeStyles.splice(index, 1);
        }
      }
      // Other specific reset codes
      else if (ansi.startsWith('\u001B[') && ansi.endsWith('m')) {
        const code = ansi.slice(2, -1);

        // Foreground color reset
        if (code === '39') {
          const index = activeStyles.findIndex(s => {
            if (!s.startsWith('\u001B[') || !s.endsWith('m')) return false;
            const styleCode = s.slice(2, -1);
            return (
              (styleCode >= '30' && styleCode <= '37') ||
              (styleCode >= '90' && styleCode <= '97') ||
              styleCode.startsWith('38;')
            );
          });
          if (index !== -1) {
            activeStyles.splice(index, 1);
          }
        }
        // Background color reset
        else if (code === '49') {
          const index = activeStyles.findIndex(s => {
            if (!s.startsWith('\u001B[') || !s.endsWith('m')) return false;
            const styleCode = s.slice(2, -1);
            return (
              (styleCode >= '40' && styleCode <= '47') ||
              (styleCode >= '100' && styleCode <= '107') ||
              styleCode.startsWith('48;')
            );
          });
          if (index !== -1) {
            activeStyles.splice(index, 1);
          }
        }
        // Other specific reset codes
        else if (['22', '23', '24', '27', '28', '29'].includes(code)) {
          const targetCode = {
            '22': '1',  // Bold reset
            '23': '3',  // Italic reset
            '24': '4',  // Underline reset
            '27': '7',  // Inverse reset
            '28': '8',  // Hidden reset
            '29': '9',  // Strikethrough reset
          }[code];

          const index = activeStyles.findIndex(s => {
            if (!s.startsWith('\u001B[') || !s.endsWith('m')) return false;
            return s.slice(2, -1) === targetCode;
          });

          if (index !== -1) {
            activeStyles.splice(index, 1);
          }
        }
        // Opening style - add to active styles
        else {
          // Check if we need to replace a style of the same type
          if (code >= '30' && code <= '37' || code >= '90' && code <= '97' || code.startsWith('38;')) {
            // Remove any existing foreground color
            const index = activeStyles.findIndex(s => {
              if (!s.startsWith('\u001B[') || !s.endsWith('m')) return false;
              const styleCode = s.slice(2, -1);
              return (
                (styleCode >= '30' && styleCode <= '37') ||
                (styleCode >= '90' && styleCode <= '97') ||
                styleCode.startsWith('38;')
              );
            });
            if (index !== -1) {
              activeStyles.splice(index, 1);
            }
          }
          else if (code >= '40' && code <= '47' || code >= '100' && code <= '107' || code.startsWith('48;')) {
            // Remove any existing background color
            const index = activeStyles.findIndex(s => {
              if (!s.startsWith('\u001B[') || !s.endsWith('m')) return false;
              const styleCode = s.slice(2, -1);
              return (
                (styleCode >= '40' && styleCode <= '47') ||
                (styleCode >= '100' && styleCode <= '107') ||
                styleCode.startsWith('48;')
              );
            });
            if (index !== -1) {
              activeStyles.splice(index, 1);
            }
          }
          else if (['1', '3', '4', '7', '8', '9'].includes(code)) {
            // Remove any existing style of the same type
            const index = activeStyles.findIndex(s => {
              if (!s.startsWith('\u001B[') || !s.endsWith('m')) return false;
              return s.slice(2, -1) === code;
            });
            if (index !== -1) {
              activeStyles.splice(index, 1);
            }
          }

          // Add the new style
          activeStyles.push(ansi);
        }
      }
      // Hyperlink start
      else if (ansi.startsWith('\u001B]8;;') && !ansi.endsWith('\u001B]8;;\u0007')) {
        // Remove any existing hyperlink
        const index = activeStyles.findIndex(s => s.startsWith('\u001B]8;;') && !s.endsWith('\u001B]8;;\u0007'));
        if (index !== -1) {
          activeStyles.splice(index, 1);
        }

        // Add the new hyperlink
        activeStyles.push(ansi);
      }
    }

    // Skip empty parts after processing the style
    if (text === '') {
      continue;
    }

    // Get all closing sequences from the original input
    // that would close the active styles
    let closingSequence = '';

    // If any styles are active, find the appropriate closing sequences
    if (activeStyles.length > 0) {
      // Check if there's a full reset in the input
      if (closingSequences.includes('\u001B[0m')) {
        closingSequence = '\u001B[0m';
      }
      // Otherwise, use specific closing codes
      else {
        const needsHyperlinkClose = activeStyles.some(s => s.startsWith('\u001B]8;;') && !s.endsWith('\u001B]8;;\u0007'));
        const needsForegroundClose = activeStyles.some(s => {
          if (!s.startsWith('\u001B[') || !s.endsWith('m')) return false;
          const code = s.slice(2, -1);
          return (code >= '30' && code <= '37') || (code >= '90' && code <= '97') || code.startsWith('38;');
        });
        const needsBackgroundClose = activeStyles.some(s => {
          if (!s.startsWith('\u001B[') || !s.endsWith('m')) return false;
          const code = s.slice(2, -1);
          return (code >= '40' && code <= '47') || (code >= '100' && code <= '107') || code.startsWith('48;');
        });
        const needsBoldClose = activeStyles.some(s => s === '\u001B[1m');
        const needsItalicClose = activeStyles.some(s => s === '\u001B[3m');
        const needsUnderlineClose = activeStyles.some(s => s === '\u001B[4m');
        const needsInverseClose = activeStyles.some(s => s === '\u001B[7m');
        const needsHiddenClose = activeStyles.some(s => s === '\u001B[8m');
        const needsStrikethroughClose = activeStyles.some(s => s === '\u001B[9m');

        if (needsHyperlinkClose && closingSequences.includes('\u001B]8;;\u0007')) {
          closingSequence += '\u001B]8;;\u0007';
        }
        if (needsForegroundClose && closingSequences.includes('\u001B[39m')) {
          closingSequence += '\u001B[39m';
        }
        if (needsBackgroundClose && closingSequences.includes('\u001B[49m')) {
          closingSequence += '\u001B[49m';
        }
        if (needsBoldClose && closingSequences.includes('\u001B[22m')) {
          closingSequence += '\u001B[22m';
        }
        if (needsItalicClose && closingSequences.includes('\u001B[23m')) {
          closingSequence += '\u001B[23m';
        }
        if (needsUnderlineClose && closingSequences.includes('\u001B[24m')) {
          closingSequence += '\u001B[24m';
        }
        if (needsInverseClose && closingSequences.includes('\u001B[27m')) {
          closingSequence += '\u001B[27m';
        }
        if (needsHiddenClose && closingSequences.includes('\u001B[28m')) {
          closingSequence += '\u001B[28m';
        }
        if (needsStrikethroughClose && closingSequences.includes('\u001B[29m')) {
          closingSequence += '\u001B[29m';
        }
      }
    }

    // Create the segment
    segments.push({
      content: text,
      visibleLength: getStringWidth(text, {
        wideWidth: 1,
        fullWidth: 1,
      }),
      before: activeStyles.join(''),
      after: closingSequence
    });
  }

  return segments;
}


/**
 * High-performance function to slice ANSI-colored strings while preserving style codes.
 * Uses a segment-based approach that directly associates styling with content.
 * Handles all ANSI codes including unknown ones.
 *
 * @param {string} inputString - The original string with ANSI escape codes
 * @param {number} startIndex - Start index for the slice (default: 0)
 * @param {number} endIndex - End index for the slice (default: string length)
 * @returns {string} The sliced string with preserved ANSI styling
 */
function slice(inputString: string, startIndex = 0, endIndex = inputString.length): string {
  // Early returns for simple cases
  if (startIndex >= endIndex || inputString === "") {
    return "";
  }

  // No slicing needed
  if (startIndex === 0 && endIndex >= inputString.length) {
    return inputString;
  }

  // Negative indices not supported
  if (startIndex < 0 || endIndex < 0) {
    throw new RangeError("Negative indices aren't supported");
  }

  // Process the string into styled segments
  const segments = processIntoStyledSegments(inputString);

  // Find visible segments
  let currentPos = 0;
  const visibleSegments: {
    index: number;
    start: number;
    end: number;
    segment: StyledSegment;
  }[] = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const segmentStart = currentPos;
    const segmentEnd = currentPos + segment.visibleLength;

    // Check if this segment is visible in the slice
    if (segmentEnd > startIndex && segmentStart < endIndex) {
      const visibleStart = Math.max(0, startIndex - segmentStart);
      const visibleEnd = Math.min(segment.visibleLength, endIndex - segmentStart);

      visibleSegments.push({
        index: i,
        start: visibleStart,
        end: visibleEnd,
        segment
      });
    }

    currentPos = segmentEnd;
  }

  if (visibleSegments.length === 0) {
    return "";
  }

  // Build the result
  const resultParts: string[] = [];

  // Add styling for first segment
  const firstSegmentInfo = visibleSegments[0];
  resultParts.push(firstSegmentInfo.segment.before);

  // Process each visible segment
  for (let i = 0; i < visibleSegments.length; i++) {
    const { segment, start, end } = visibleSegments[i];

    // Slice the visible content
    let slicedContent;
    if (start === 0 && end === segment.visibleLength) {
      // Full segment
      slicedContent = segment.content;
    } else {
      // Partial segment - need to handle graphemes properly
      const graphemes = Array.from(
        segmenter.segment(segment.content)
      );

      slicedContent = graphemes
        .slice(start, end)
        .map(entry => entry.segment)
        .join('');
    }

    resultParts.push(slicedContent);

    // If not the last segment, handle transitions between segments
    if (i < visibleSegments.length - 1) {
      const nextSegment = visibleSegments[i + 1].segment;

      // If segments have different styling, add closing for current and opening for next
      if (segment.after !== '' || nextSegment.before !== '') {
        // Check if we need to add closing and opening styles
        // Only add them if they're different
        if (segment.after !== nextSegment.before) {
          resultParts.push(segment.after);
          resultParts.push(nextSegment.before);
        }
      }
    }
  }

  // Add closing styling from the last segment
  const lastSegmentInfo = visibleSegments[visibleSegments.length - 1];
  resultParts.push(lastSegmentInfo.segment.after);

  return resultParts.join('');
}

export default slice;