'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle } from 'lucide-react';

/**
 * Two-step confirmation dialog for conversation deletion.
 *
 * Step 1 – Warning listing what will be lost.
 * Step 2 – Typed confirmation (conversation title or "delete") to unlock
 *          the final delete button.
 *
 * Props:
 *   open            – boolean
 *   onOpenChange    – (open: boolean) => void
 *   conversationTitle – string shown to the user & used for typed confirm
 *   childName       – optional child/profile name for context
 *   onConfirmDelete – () => void  (called when final delete confirmed)
 *   isBatch         – boolean (if true, adjusts copy for batch delete)
 *   batchCount      – number  (how many items in batch)
 */
export default function DeleteConversationConfirm({
  open,
  onOpenChange,
  conversationTitle,
  childName,
  onConfirmDelete,
  isBatch = false,
  batchCount = 0,
}) {
  const [step, setStep] = useState(1);
  const [typedValue, setTypedValue] = useState('');

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setStep(1);
      setTypedValue('');
    }
  }, [open]);

  const confirmTarget = conversationTitle || 'delete';
  const isMatch =
    typedValue.trim().toLowerCase() === confirmTarget.toLowerCase() ||
    typedValue.trim().toLowerCase() === 'delete';

  const profileLabel = childName || conversationTitle || 'this profile';

  const handleClose = () => onOpenChange(false);

  const handleContinue = () => setStep(2);

  const handleFinalDelete = () => {
    if (!isMatch) return;
    onConfirmDelete();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {step === 1 ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 text-amber-500 mb-1">
                <AlertTriangle className="h-5 w-5" />
                <DialogTitle className="text-amber-500">
                  {isBatch
                    ? `Delete ${batchCount} archived profiles?`
                    : `Delete "${conversationTitle || 'Conversation'}"?`}
                </DialogTitle>
              </div>
              <DialogDescription asChild>
                <div className="text-sm text-muted-foreground space-y-3 pt-2">
                  <p>
                    {isBatch
                      ? `Deleting all ${batchCount} archived profiles will permanently remove the following data for each profile:`
                      : <>Deleting this conversation will permanently remove all associated data for <strong>{profileLabel}</strong>:</>}
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>School visits and tour schedules</li>
                    <li>Tour prep kits</li>
                    <li>Debrief notes</li>
                    <li>Match history and school rankings</li>
                  </ul>
                  <p className="font-medium text-destructive">This action cannot be undone.</p>
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-row gap-2 sm:justify-end">
              <Button variant="default" onClick={handleClose}>
                Cancel
              </Button>
              <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700" onClick={handleContinue}>
                I understand, continue
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                Confirm deletion
              </DialogTitle>
              <DialogDescription asChild>
                <div className="text-sm text-muted-foreground space-y-3 pt-2">
                  <p>
                    {isBatch
                      ? <>Type <strong className="select-all text-foreground">delete</strong> to confirm permanent deletion of all {batchCount} archived profiles.</>
                      : <>Type <strong className="select-all text-foreground">{confirmTarget}</strong> or <strong className="select-all text-foreground">delete</strong> to confirm.</>}
                  </p>
                </div>
              </DialogDescription>
            </DialogHeader>
            <Input
              autoFocus
              placeholder={isBatch ? 'Type "delete"' : `Type "${confirmTarget}" or "delete"`}
              value={typedValue}
              onChange={(e) => setTypedValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isMatch) handleFinalDelete();
              }}
              className="my-2"
            />
            <DialogFooter className="flex-row gap-2 sm:justify-end">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={!isMatch}
                onClick={handleFinalDelete}
              >
                {isBatch ? 'Permanently delete all' : 'Permanently delete'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
