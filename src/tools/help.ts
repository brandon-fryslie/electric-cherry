/**
 * Help tool — install instructions for various tools
 */

import { successResponse } from '../response.js';

const INSTALL_INSTRUCTIONS = `Electric Cherry — Install Instructions

Claude Code:
  claude mcp add -s project electric-cherry npx electric-cherry
`;

export function help(): { content: Array<{ type: 'text'; text: string }> } {
  return successResponse(INSTALL_INSTRUCTIONS);
}
