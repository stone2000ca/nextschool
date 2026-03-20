// Function: fetchSchoolNotes
// Purpose: Fetch a user's research notes for a specific school, with truncation for prompt injection
// Entities: ResearchNote (notes table)
// Last Modified: 2026-03-20

import { ResearchNote } from '@/lib/entities-server'

const MAX_NOTES_LENGTH = 1500;

/**
 * Fetches the user's research notes for a given school.
 * Returns the note text (truncated if needed) or null if none exist.
 */
export async function fetchSchoolNotes(
  userId: string,
  schoolId: string
): Promise<string | null> {
  if (!userId || !schoolId) return null;

  try {
    const notes = await ResearchNote.filter({ user_id: userId, school_id: schoolId });
    if (!notes || notes.length === 0) return null;

    // Use the most recently updated note
    const sorted = notes.sort((a: any, b: any) =>
      new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
    );
    const noteText = (sorted[0].notes || '').trim();
    if (!noteText) return null;

    if (noteText.length <= MAX_NOTES_LENGTH) return noteText;

    return noteText.substring(0, MAX_NOTES_LENGTH) + ' [truncated]';
  } catch (e: any) {
    console.warn('[fetchSchoolNotes] Failed to fetch notes:', e.message);
    return null;
  }
}
